# 已发布 app 的运行镜像. kaniko build 用 (build context = workspace dir).
# 静态资源 vite build 出 dist/client/, 由 NestJS @nestjs/serve-static 提供;
# 后端 nest build 出 dist/main.js.
FROM node:20-alpine AS build
WORKDIR /app
# .npmrc 必须在 install 前 COPY: 它带 node-linker=hoisted/shamefully-hoist,
# 决定 node_modules 布局。漏了 → 镜像内 pnpm 走默认隔离布局, 与 builder
# workspace (有 .npmrc, 打平) 不一致, 直接 import 的传递依赖 (如 express)
# 在镜像里 `Cannot find module`。* 通配: 没有也不报错。
COPY package.json pnpm-lock.yaml* package-lock.json* yarn.lock* .npmrc* ./
# 优先 pnpm (跟 builder workspace 一致), 退化 npm
RUN if [ -f pnpm-lock.yaml ]; then \
      npm i -g pnpm@9 && pnpm install --no-frozen-lockfile; \
    elif [ -f yarn.lock ]; then \
      yarn install; \
    else \
      npm install --no-audit --no-fund; \
    fi
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
# 入口解析: 默认 nest build → dist/main.js; 但若 app 改了 tsconfig.server 的 outDir/rootDir
# 产物会落别处 → 旧的硬编码 CMD 启动即崩 "Cannot find module '/app/dist/main.js'":
#   - dist/server/main.js            (保留 server/ 子目录, 2026-06-18 账单 01KVCBPC 实证)
#   - dist/server-build/server/main.js (outDir=dist/server-build, 2026-07-14 账单 01KX2S89 实证)
# 修复: 先按已知布局顺序探测, 再 find 兜底任意 dist/**/main.js(排除 dist/client 的前端产物),
# 彻底防呆未来第 N 种 outDir 布局。三种都找不到才打印 dist 目录树并非 0 退出, 便于排查。
CMD ["sh", "-c", "ENTRY=''; for p in dist/main.js dist/server/main.js dist/server-build/server/main.js; do [ -f \"$p\" ] && { ENTRY=\"$p\"; break; }; done; [ -z \"$ENTRY\" ] && ENTRY=$(find dist -name main.js -not -path 'dist/client/*' 2>/dev/null | head -1); if [ -n \"$ENTRY\" ]; then echo \"[entry] node $ENTRY\"; exec node \"$ENTRY\"; else echo 'FATAL: 找不到后端入口 (dist/**/main.js)'; ls -R dist || true; exit 1; fi"]
