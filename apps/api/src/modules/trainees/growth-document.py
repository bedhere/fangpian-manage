"""Bounded, offline text extraction; no network, macros or embedded objects."""
import json, pathlib, re, subprocess, sys, zipfile, xml.etree.ElementTree as ET

path, extension = pathlib.Path(sys.argv[1]), sys.argv[2]
if path.stat().st_size > 8 * 1024 * 1024:
    raise ValueError('文件不能超过8MB')
if extension in ('.txt', '.md'):
    data = path.read_bytes()
    try:
        text = data.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = data.decode('gb18030')
elif extension == '.docx':
    with zipfile.ZipFile(path) as archive:
        infos = archive.infolist()
        if len(infos) > 2000 or sum(x.file_size for x in infos) > 40 * 1024 * 1024:
            raise ValueError('DOCX解压内容过大')
        info = archive.getinfo('word/document.xml')
        if info.file_size > 8 * 1024 * 1024:
            raise ValueError('DOCX正文过大')
        xml = archive.read(info)
        if b'<!DOCTYPE' in xml or b'<!ENTITY' in xml:
            raise ValueError('不支持的XML内容')
        root = ET.fromstring(xml)
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        text = '\n'.join(''.join(p.itertext()) for p in root.findall('.//w:p', ns))
elif extension == '.pdf':
    if not path.read_bytes()[:1024].lstrip().startswith(b'%PDF-'):
        raise ValueError('不是有效的PDF文件')
    info = subprocess.run(['pdfinfo', str(path)], capture_output=True, timeout=5, check=True)
    pages = re.search(rb'^Pages:\s*(\d+)', info.stdout, re.M)
    if not pages or int(pages.group(1)) > 100:
        raise ValueError('PDF不得超过100页，请拆分后再上传')
    result = subprocess.run(['pdftotext', '-enc', 'UTF-8', str(path), '-'],
                            capture_output=True, timeout=25, check=True)
    text = result.stdout.decode('utf-8')
else:
    raise ValueError('仅支持TXT、MD、DOCX及文本PDF')
text = text.replace('\x00', '').strip()
if not text:
    raise ValueError('未提取到文字；扫描PDF请先转换为文本文件')
if len(text) > 100000:
    raise ValueError('正文超过10万字，请拆分文件后再上传')
print(json.dumps({'text': text}, ensure_ascii=False))
