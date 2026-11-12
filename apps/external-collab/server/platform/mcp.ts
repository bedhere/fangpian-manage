// Original connector interface, backed by the cloud's authorized official CLI and local OCR.
import { runNative, type NativeRunner } from './native-process'
export { ocr } from './native-ocr'

export class PlatformAuthError extends Error {}
export class ConnectorNotBoundError extends Error {}
export interface CLIOpts { stdin?: string; timeoutSeconds?: number }
export interface MCPToolInfo { name: string; description?: string; inputSchema?: Record<string, unknown> }
export interface MCPToolList { count: number; tools: MCPToolInfo[]; prefixes?: string[]; exact?: string[] }
interface Configuration { bin: string; configDir: string }
const commands = [['sheet','get'], ['sheet','ranges-get'], ['sheet','merge','get'], ['smartsheet','records','list']]
const flags = new Set(['--docid','--sheet-id','--range','--mode','--type','--field-ids','--key-type','--limit','--start','--filter-spec','--json'])
export class NativeWecom {
  constructor(private readonly runner: NativeRunner = runNative, private readonly config: Configuration = { bin: process.env.WECOM_CLI_BIN || '/usr/local/bin/wecom-cli', configDir: process.env.WECOM_CLI_CONFIG_DIR || '' }) {}
  async cli(argv: string[], opts: CLIOpts = {}): Promise<any> {
    if (!this.config.bin || !this.config.configDir) throw new ConnectorNotBoundError('示例品牌连接尚未配置，请联系管理员检查已授权的企微 CLI')
    if (!Array.isArray(argv) || argv.length > 100 || argv.some(value => typeof value !== 'string' || value.length > 128_000 || /[\0\r\n]/.test(value))) throw new Error('企微命令参数无效')
    if (!commands.some(command => command.every((value, index) => argv[index] === value))) throw new Error('外采仅支持企微表格只读命令')
    for (const value of argv) if (value.startsWith('--') && !flags.has(value)) throw new Error('不支持的企微命令参数')
    const documentIndex = argv.indexOf('--docid')
    const jsonIndex = argv.indexOf('--json')
    let documentValue = documentIndex >= 0 ? argv[documentIndex + 1] : undefined
    if (jsonIndex >= 0) {
      let parameters: any
      try { parameters = JSON.parse(argv[jsonIndex + 1]) } catch { throw new Error('企微 JSON 参数无效') }
      if (!parameters || typeof parameters.docid !== 'string' || typeof parameters.sheet !== 'string' || typeof parameters.range !== 'string' || Object.keys(parameters).some(key => !['docid','sheet','range'].includes(key))) throw new Error('企微 JSON 参数无效')
      documentValue = parameters.docid
    }
    if (!documentValue) throw new Error('缺少企微文档参数')
    const document = new URL(documentValue)
    if (document.protocol !== 'https:' || document.hostname !== 'doc.weixin.qq.com' || document.username || document.password || document.port || document.hash) throw new Error('仅支持官方示例品牌文档地址')
    if (opts.stdin !== undefined && (typeof opts.stdin !== 'string' || Buffer.byteLength(opts.stdin) > 1024 * 1024)) throw new Error('企微命令输入过大')
    const timeout = Math.min(120, Math.max(1, Math.trunc(opts.timeoutSeconds ?? 30)))
    if (!Number.isFinite(timeout)) throw new Error('企微命令超时参数无效')
    let stdout: string
    try { stdout = await this.runner(this.config.bin, [...argv], { timeout: timeout * 1000, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8', shell: false, killSignal: 'SIGKILL', env: { ...process.env, WECOM_CLI_CONFIG_DIR: this.config.configDir } }, opts.stdin) }
    catch { throw new Error('示例品牌连接超时或不可用，请核对云端授权后重试') }
    try { return JSON.parse(stdout) } catch { return { text: stdout } }
  }
  whoAmI() { throw new Error('请在现有企微授权管理中查看连接状态') }
  listCommands() { return Promise.resolve({ text: commands.map(command => command.join(' ')).join('\n') }) }
}
export const wecom = new NativeWecom()
export const mcp = {
  async call<T = any>(tool: string, args: Record<string, any> = {}): Promise<T> {
    if (tool === 'wecom_cli') return wecom.cli(args.argv, { stdin: args.stdin, timeoutSeconds: args.timeout_seconds })
    if (tool === 'ocr_recognize') { const { ocr } = await import('./native-ocr'); return ocr.recognize(args.image_url, args.type, args.output_table) as Promise<T> }
    throw new Error('此连接器未在独立云端配置')
  },
  async tools(): Promise<MCPToolList> { return { count: 2, tools: [{ name: 'wecom_cli', description: '授权示例品牌文档只读 CLI' }, { name: 'ocr_recognize', description: '本模块上传图片的本地 OCR' }] } },
}
