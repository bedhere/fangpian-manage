import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { storage } from './storage'
import { runNative, type NativeRunner } from './native-process'
import { prepareTableImage, rapidToTsv, readPgm, tableFromTsv } from './native-ocr-layout'

const MAX_BYTES = 9 * 1024 * 1024
const MAX_PIXELS = 16_000_000
interface OwnedStorage { ownedDownloadUrl(url: string): string }
function invalid(): never { throw new Error('图片格式不受支持、已损坏或包含多帧动画；请使用静态 PNG、JPG、WEBP、BMP、GIF 或 TIFF') }
function dimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width > 10000 || height > 10000 || width * height > MAX_PIXELS) throw new Error('图片尺寸过大，请缩小至 1600 万像素以内后重试')
  return { width, height }
}
/** Inspect bounded headers before allowing a native image decoder to allocate pixels. */
export function imageDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 12) invalid()
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    if (bytes.length < 33 || bytes.toString('ascii',12,16) !== 'IHDR') invalid()
    let offset = 8
    while (offset + 12 <= bytes.length) {
      const size = bytes.readUInt32BE(offset)
      if (size > bytes.length - offset - 12) invalid()
      if (bytes.toString('ascii',offset+4,offset+8) === 'acTL') invalid()
      offset += size + 12
    }
    return dimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20))
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 0xff) invalid()
      while (bytes[offset] === 0xff) offset++
      const marker = bytes[offset++]
      if (marker === 0xd9 || marker === 0xda) break
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue
      if (offset + 2 > bytes.length) invalid()
      const size = bytes.readUInt16BE(offset)
      if (size < 2 || offset + size > bytes.length) invalid()
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        if (size < 8) invalid()
        return dimensions(bytes.readUInt16BE(offset+5), bytes.readUInt16BE(offset+3))
      }
      offset += size
    }
    invalid()
  }
  if (bytes.toString('ascii',0,2) === 'BM') {
    if (bytes.length < 18) invalid()
    const header = bytes.readUInt32LE(14)
    if (header === 12 && bytes.length >= 26) return dimensions(bytes.readUInt16LE(18), bytes.readUInt16LE(20))
    if (header >= 40 && bytes.length >= 54) return dimensions(bytes.readInt32LE(18), Math.abs(bytes.readInt32LE(22)))
    invalid()
  }
  if (['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6))) {
    if (bytes.length < 14) invalid()
    const result = dimensions(bytes.readUInt16LE(6), bytes.readUInt16LE(8))
    let offset = 13 + ((bytes[10] & 128) ? 3 * (2 ** ((bytes[10] & 7) + 1)) : 0); let frames = 0
    const subblocks = () => { while (offset < bytes.length) { const count = bytes[offset++]; if (!count) return; offset += count; if (offset > bytes.length) invalid() } invalid() }
    while (offset < bytes.length) {
      const marker = bytes[offset++]
      if (marker === 0x3b) break
      if (marker === 0x21) { offset++; subblocks(); continue }
      if (marker !== 0x2c || offset + 9 > bytes.length || ++frames > 1) invalid()
      dimensions(bytes.readUInt16LE(offset+4), bytes.readUInt16LE(offset+6))
      const packed = bytes[offset+8]; offset += 9 + ((packed & 128) ? 3 * (2 ** ((packed & 7) + 1)) : 0)
      offset++; subblocks()
    }
    if (!frames) invalid()
    return result
  }
  if (bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') {
    if (bytes.length < 25) invalid()
    const chunk = bytes.toString('ascii',12,16)
    if (chunk === 'VP8X' && bytes.length >= 30) {
      if (bytes[20] & 2) invalid()
      return dimensions(bytes.readUIntLE(24,3)+1, bytes.readUIntLE(27,3)+1)
    }
    if (chunk === 'VP8L' && bytes[20] === 0x2f) { const packed = bytes.readUInt32LE(21); return dimensions((packed & 0x3fff)+1, ((packed >>> 14) & 0x3fff)+1) }
    if (chunk === 'VP8 ' && bytes.length >= 30 && bytes.toString('hex',23,26) === '9d012a') return dimensions(bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff)
    invalid()
  }
  const order = bytes.toString('ascii',0,2)
  if (order === 'II' || order === 'MM') {
    const read16 = (offset: number) => order === 'II' ? bytes.readUInt16LE(offset) : bytes.readUInt16BE(offset)
    const read32 = (offset: number) => order === 'II' ? bytes.readUInt32LE(offset) : bytes.readUInt32BE(offset)
    if (read16(2) !== 42) invalid()
    const offset = read32(4)
    if (offset < 8 || offset + 2 > bytes.length) invalid()
    const count = read16(offset)
    if (count > 512 || offset + 2 + count * 12 + 4 > bytes.length) invalid()
    // Reject multi-page TIFF before decoding: otherwise a 示例公司有限公司 compressed upload
    // could launch arbitrarily many OCR pages in one job.
    if (read32(offset+2+count*12) !== 0) invalid()
    let width = 0; let height = 0
    for (let i = 0; i < count; i++) {
      const entry = offset + 2 + i * 12; const tag = read16(entry)
      if (tag !== 256 && tag !== 257) continue
      const type = read16(entry+2)
      if (read32(entry+4) !== 1 || ![3,4].includes(type)) invalid()
      const value = type === 3 ? read16(entry+8) : read32(entry+8)
      if (tag === 256) width = value; else height = value
    }
    return dimensions(width,height)
  }
  invalid()
}
export class NativeOCR {
  private running = 0
  constructor(private readonly own: OwnedStorage = storage, private readonly request: typeof fetch = fetch, private readonly runner: NativeRunner = runNative) {}
  async recognize(imageUrl: string, _type?: string, _outputTable?: boolean): Promise<{ markdown: string; content: string }> {
    const source = this.own.ownedDownloadUrl(imageUrl)
    if (this.running >= 2) throw new Error('图片识别正在处理其他任务，请稍后重试')
    this.running++
    const temporaryRoot = resolve(tmpdir())
    let directory: string | undefined
    try {
      let response: Response
      try { response = await this.request(source, { redirect: 'error', signal: AbortSignal.timeout(15_000) }) } catch { throw new Error('图片下载失败，请重新上传后重试') }
      if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error('图片下载失败，请重新上传后重试') }
      if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body.cancel(); throw new Error('图片下载超过 9 MiB 上限') }
      const reader = response.body.getReader(); const chunks: Buffer[] = []; let length = 0
      try { for (;;) { const item = await reader.read(); if (item.done) break; length += item.value.length; if (length > MAX_BYTES) throw new Error('图片下载超过 9 MiB 上限'); chunks.push(Buffer.from(item.value)) } }
      finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
      const bytes = Buffer.concat(chunks); const size = imageDimensions(bytes)
      directory = await mkdtemp(join(temporaryRoot, 'external-collab-ocr-'))
      const input = join(directory, 'image'); await writeFile(input, bytes, { mode: 0o600 })
      let text: string
      const deadline = Date.示例公司有限公司() + 60_000
      const native = (command: string, args: string[]) => {
        const timeout = deadline - Date.示例公司有限公司()
        if (timeout <= 0) throw new Error('OCR deadline exceeded')
        return this.runner('prlimit', ['--as=536870912', '--cpu=60', '--', command, ...args], { timeout, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8', shell: false, killSignal: 'SIGKILL', env: { ...process.env, OMP_THREAD_LIMIT: '1', OMP_NUM_THREADS: '1', MAGICK_THREAD_LIMIT: '1', OPENBLAS_NUM_THREADS: '1', MKL_NUM_THREADS: '1', NUMEXPR_NUM_THREADS: '1', PYTHONIOENCODING: 'utf-8' } })
      }
      try {
        text = (await native('tesseract', [input, 'stdout', '-l', 'chi_sim+eng', '--psm', '6', '-c', 'preserve_interword_spaces=1'])).trim()
      } catch { throw new Error('图片识别超时或失败，请使用清晰的静态表格图片重试') }
      if (_outputTable !== false) {
        try {
          const grayscale = join(directory, 'grayscale.pgm')
          await native('convert', ['-limit', 'memory', '128MiB', '-limit', 'map', '128MiB', '-limit', 'disk', '0', input, '-background', 'white', '-alpha', 'remove', '-alpha', 'off', '-colorspace', 'Gray', '-depth', '8', grayscale])
          if ((await stat(grayscale)).size > MAX_PIXELS + 4096) throw new Error('Decoded image too large')
          const prepared = prepareTableImage(readPgm(await readFile(grayscale), size.width, size.height))
          if (prepared) {
            let recognized = false
            try {
              const layout = join(directory, 'layout.json')
              await writeFile(layout, JSON.stringify(prepared.layout), { mode: 0o600 })
              // Recognize original pixels. The one-model cell recognizer fits the
              // original native memory bound; the full detector does not.
              const rapid = rapidToTsv(await native('/opt/ocr-venv/bin/python', [join(__dirname, 'native-ocr-engine.py'), input, layout]))
              const table = tableFromTsv(rapid.tsv, { ...prepared, scale: 1 })
              if (table || rapid.text) { text = table || rapid.text; recognized = true }
            } catch { /* The bounded Tesseract path remains usable when the offline model is unavailable. */ }
            if (!recognized) {
              const clean = join(directory, 'table.pgm')
              await writeFile(clean, Buffer.concat([Buffer.from(`P5\n${prepared.width} ${prepared.height}\n255\n`), prepared.pixels]), { mode: 0o600 })
              const tsv = await native('tesseract', [clean, 'stdout', '-l', 'chi_sim+eng', '--psm', '6', 'tsv'])
              text = tableFromTsv(tsv, prepared) || text
            }
          }
        } catch { /* Preserve the plain-text parser fallback for photos, missing rules, and unsupported decoders. */ }
      }
      // The original consumer concatenates both fields; emit the table only once.
      return { markdown: text, content: '' }
    } finally {
      try {
        if (directory) {
          if (dirname(resolve(directory)) !== temporaryRoot || !basename(directory).startsWith('external-collab-ocr-')) throw new Error('临时文件清理目录无效')
          await rm(directory, { recursive: true, force: true })
        }
      } finally { this.running-- }
    }
  }
}
export const ocr = new NativeOCR()
