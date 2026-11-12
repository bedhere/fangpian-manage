"""Offline, single-thread table-cell recognition; invoked only through bounded native-process."""
import json
import os
import sys
from pathlib import Path


def grid_regions(gray, columns, rows):
    import numpy as np
    height, width = gray.shape
    for lines, maximum, limit in [(columns, width, 65), (rows, height, 101)]:
        if (not isinstance(lines, list) or not 3 <= len(lines) <= limit
                or any(not isinstance(n, int) or n < 0 or n >= maximum for n in lines)
                or any(a >= b for a, b in zip(lines, lines[1:]))):
            raise ValueError('Invalid table geometry')
    cols, row_count = len(columns) - 1, len(rows) - 1
    parents = list(range(cols * row_count))

    def root(n):
        while parents[n] != n:
            parents[n] = parents[parents[n]]
            n = parents[n]
        return n

    def union(a, b):
        parents[root(a)] = root(b)

    for r in range(row_count):
        for c in range(cols):
            if r:
                y, x0, x1 = rows[r], columns[c] + 1, columns[c + 1]
                background = float(np.percentile(gray[max(0, y - 2):y + 3, x0:x1], 90))
                if np.mean(gray[y, x0:x1] < background * .95) < .5:
                    union(r * cols + c, (r - 1) * cols + c)
            if c:
                x, y0, y1 = columns[c], rows[r] + 1, rows[r + 1]
                background = float(np.percentile(gray[y0:y1, max(0, x - 2):x + 3], 90))
                if np.mean(gray[y0:y1, x] < background * .95) < .5:
                    union(r * cols + c, r * cols + c - 1)
    groups = {}
    for r in range(row_count):
        for c in range(cols):
            groups.setdefault(root(r * cols + c), []).append((r, c))
    regions = []
    for group in groups.values():
        r0, r1 = min(r for r, c in group), max(r for r, c in group)
        c0, c1 = min(c for r, c in group), max(c for r, c in group)
        if len(group) != (r1 - r0 + 1) * (c1 - c0 + 1):
            raise ValueError('Ambiguous table geometry')
        regions.append((columns[c0] + 1, rows[r0] + 1, columns[c1 + 1], rows[r1 + 1]))
    return regions


def recognize(source, layout):
    for name in ['OMP_NUM_THREADS', 'OMP_THREAD_LIMIT', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'NUMEXPR_NUM_THREADS']:
        os.environ[name] = '1'
    import cv2
    import numpy as np
    import yaml
    import rapidocr_onnxruntime
    from rapidocr_onnxruntime.ch_ppocr_rec import TextRecognizer
    cv2.setNumThreads(1)
    if Path(source).stat().st_size > 9 * 1024 * 1024:
        raise ValueError('Image too large')
    image = cv2.imdecode(np.fromfile(source, np.uint8), cv2.IMREAD_COLOR)
    if image is None or image.shape[0] * image.shape[1] > 16_000_000:
        raise ValueError('Invalid image dimensions')
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    regions, crops = [], []
    for x0, y0, x1, y1 in grid_regions(gray, layout['columns'], layout['rows']):
        cell = image[y0:y1, x0:x1].copy()
        shade = gray[y0:y1, x0:x1]
        background = float(np.percentile(shade, 90))
        yy, xx = np.where(shade < background * .87)
        if not len(xx):
            continue
        left, right = max(0, int(xx.min()) - 2), min(cell.shape[1], int(xx.max()) + 3)
        top, bottom = max(0, int(yy.min()) - 2), min(cell.shape[0], int(yy.max()) + 3)
        crops.append(cell[top:bottom, left:right])
        regions.append([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
    if not crops:
        return {'results': []}
    package = Path(rapidocr_onnxruntime.__file__).parent
    config = yaml.safe_load((package / 'config.yaml').read_text(encoding='utf8'))['Rec']
    config.update(model_path=str(package / config['model_path']), intra_op_num_threads=1,
                  inter_op_num_threads=1, rec_batch_num=1)
    recognizer = TextRecognizer(config)
    recognized, _ = recognizer(crops)
    return {'results': [[box, text, float(score)] for box, (text, score) in zip(regions, recognized) if text]}


if __name__ == '__main__':
    try:
        if len(sys.argv) != 3:
            raise ValueError('Invalid OCR arguments')
        layout_path = Path(sys.argv[2])
        if layout_path.stat().st_size > 16 * 1024:
            raise ValueError('Invalid table geometry')
        result = recognize(sys.argv[1], json.loads(layout_path.read_text(encoding='utf8')))
        print(json.dumps(result, ensure_ascii=False))
    except Exception:
        raise SystemExit('Native table OCR failed') from None
