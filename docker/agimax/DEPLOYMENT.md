# example.invalid 部署计划

目标服务器：192.0.2.20；独立项目目录：/opt/agimax。

1. 检查现有 Caddy 网络及站点，备份入口配置。
2. 打包当前源码为 UTF-8 tar.gz，校验 SHA256 后上传。
3. 为线上部署生成独立数据库、JWT 和对象存储密钥。
4. 构建员工端、管理端、API 与 Worker，执行数据库迁移。
5. 按用户选择初始化或迁移数据库与上传文件。
6. 向现有 Caddy 追加三个独立站点，校验后热加载。
7. 验证公网 DNS、HTTPS、登录、业务接口及原有站点。

员工端：https://example.invalid
管理端：https://example.invalid
文件服务：https://example.invalid

数据服务不映射宿主机端口。应用连接现有 debian_default 入口网络，使用 agimax 专属网络别名。环境文件仅保存在服务器，权限为 600。

API 的 3001 端口也必须保持私有，不发布宿主机端口；公网请求经 Caddy 单跳直接反代 `agimax-api:3001`。仅 `api` 服务显式配置 `TRUST_PROXY_HOPS: "1"`，Express 因而采用最靠近 Caddy 的一个转发客户端地址，公开注册按客户端独立限流。客户端伪造的更早 `X-Forwarded-For` 项不能改变该地址。

本地或直连环境不设置该变量（或设置 `"0"`）时，代理信任关闭并忽略转发地址。配置只接受 `0`/`1`；布尔值、负数、小数和更大的跳数会使 API 启动失败。不要设置全量信任或向外开放 API 直连端口；如入口拓扑改变，须重新审查路径与信任边界。参见 [Express 代理信任说明](https://expressjs.com/en/guide/behind-proxies/)。
