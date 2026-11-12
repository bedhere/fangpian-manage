import { execFile } from 'node:child_process'

export interface NativeRunOptions {
  timeout: number; maxBuffer: number; shell: false; encoding: 'utf8'; env: NodeJS.ProcessEnv; killSignal?: NodeJS.Signals
}
export type NativeRunner = (file: string, args: string[], options: NativeRunOptions, stdin?: string) => Promise<string>
/** No shell, bounded output/time, and no command arguments or credential-bearing diagnostics in errors. */
export const runNative: NativeRunner = (file, args, options, stdin) => new Promise((resolve, reject) => {
  const child = execFile(file, args, options, (error, stdout) => {
    if (error) reject(new Error('云端命令执行超时或不可用，请联系管理员检查运行配置'))
    else resolve(stdout)
  })
  child.stdin?.on('error', () => { /* An early process exit is reported by execFile's callback. */ })
  child.stdin?.end(stdin ?? '')
})
