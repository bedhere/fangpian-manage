import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 关键: base 必须相对路径, 因为 Studio 预览 iframe 的 URL 前缀是 /api/v1/app/{sid}/
// 不设的话产物会引用 /assets/... 走到 studio 根域名 404.
//
// build 输出 dist/client/, NestJS 启动时 ServeStaticModule 挂这个目录.

// ── ARP Studio 预览选元素 (勿删) ────────────────────────────────────────
// 编译期给每个 JSX 宿主元素打 data-studio-loc="文件:行:列", 供预览页"点元素→改"
// 把精确源码位置交给 AI。仅当 STUDIO_INSPECT=1 (start:dev 预览构建注入) 时开启;
// 发布构建 (npm run build) 不设该 env, 属性不进生产产物。
// 见 docs/design-preview-element-inspector.md (P3)。
const INSPECT = process.env.STUDIO_INSPECT === '1'
function studioLocBabel({ types: t }: any) {
  return {
    name: 'studio-loc',
    visitor: {
      JSXOpeningElement(p: any, state: any) {
        const node = p.node
        const name = node.name
        if (!name || name.type !== 'JSXIdentifier' || !/^[a-z]/.test(name.name)) return
        if (!node.loc) return
        if (node.attributes.some((a: any) => a.type === 'JSXAttribute' && a.name && a.name.name === 'data-studio-loc')) return
        let file = state.file?.opts?.filename || ''
        if (file.includes('node_modules')) return
        try { file = path.relative(process.cwd(), file) } catch (e) {}
        node.attributes.push(t.jsxAttribute(t.jsxIdentifier('data-studio-loc'), t.stringLiteral(`${file}:${node.loc.start.line}:${node.loc.start.column}`)))
      },
    },
  }
}

export default defineConfig({
  base: '/external-collab-app/',
  plugins: [react(INSPECT ? { babel: { plugins: [studioLocBabel] } } : {})],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '@': path.resolve(__dirname, 'client/src'),
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    // NFS 不发 inotify 事件, chokidar 默认走 fs.watch 在 NFS 上根本收不到改动.
    // 仅在 dev (VITE_BUILD_WATCH=1) 时开 polling; 单次 `vite build` 不能带 watch
    // 否则 vite 不退出, BuildManager state 永远 running.
    watch: process.env.VITE_BUILD_WATCH === '1' ? { usePolling: true, interval: 800 } : null,
  },
  // 开发期可以本地起 vite 反代到 nest, 但 Studio 上是直接跑 build 后的产物.
  // 反代目标端口必须跟 server/main.ts 的监听端口一致: main.ts 用 PORT(Studio 注入
  // PORT=RUNTIME_APP_PORT=4001), 默认 3001。写死 3001 会导致 Studio pod 内若起了
  // vite dev, /api 打到没人听的 3001(后端在 4001)→ 前端连不上 API。故跟随 env。
  server: {
    port: 5173,
    proxy: { '/api': `http://localhost:${process.env.PORT || process.env.RUNTIME_APP_PORT || 3001}` },
  },
})


