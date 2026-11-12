#!/usr/bin/env bash
set -euo pipefail
cd /opt/agimax
dc() { docker compose --env-file /opt/agimax/.env -f /opt/agimax/docker/agimax/compose.yml "$@"; }
while [ ! -f /root/agimax-deploy/build.exit ]; do sleep 5; done
test "$(cat /root/agimax-deploy/build.exit)" = 0
docker build -f docker/agimax/Dockerfile.api-tls -t agimax-api:tls .
docker tag agimax-api:tls agimax-api:latest
dc up -d --wait --wait-timeout 120 postgres redis
if [ ! -f /root/agimax-deploy/database-restored ]; then
  tables=$(dc exec -T postgres psql -U valueflow -d valueflow -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
  test "$tables" = 0
  dc exec -T postgres pg_restore -U valueflow -d valueflow --no-owner --no-acl --exit-on-error < /root/agimax-deploy/database.dump
  touch /root/agimax-deploy/database-restored
fi
if [ ! -f /root/agimax-deploy/files-restored ]; then
  dc create minio
  docker run --rm --user 0:0 --entrypoint sh -v agimax_minio_data:/data -v /root/agimax-deploy:/backup:ro valueflow-minio:local -c 'tar -xzf /backup/minio-data.tar.gz -C /data'
  touch /root/agimax-deploy/files-restored
fi
dc up -d --no-build api worker web admin
dc exec -T postgres psql -U valueflow -d valueflow -c 'SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM projects) AS projects, (SELECT count(*) FROM departments) AS departments, (SELECT count(*) FROM business_requests) AS requests;'
python3 - <<'PY'
import pathlib,json,hashlib
config=pathlib.Path('/root/fangpian-content-platform/deploy/debian/Caddyfile')
text=config.read_text()
marker='# BEGIN AGIMAX DEPLOYMENT'
if marker not in text:
    fragment=pathlib.Path('/opt/agimax/docker/agimax/Caddyfile.fragment').read_text()
    config.write_text(text+'\n'+marker+'\n'+fragment+'\n# END AGIMAX DEPLOYMENT\n')
manifest=pathlib.Path('/opt/agimax/source-manifest.json')
entries=json.loads(manifest.read_text())
for item in entries:
    item['sha256']=hashlib.sha256(pathlib.Path('/opt/agimax',item['path']).read_bytes()).hexdigest()
manifest.write_text(json.dumps(entries,ensure_ascii=False,indent=2))
PY
if ! docker exec debian-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
  cat /root/agimax-deploy/Caddyfile.before-agimax > /root/fangpian-content-platform/deploy/debian/Caddyfile
  exit 1
fi
docker exec debian-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
for attempt in $(seq 1 40); do
  if curl --fail --silent --max-time 10 https://example.invalid/api/health && curl --fail --silent --max-time 10 https://example.invalid/minio/health/live; then break; fi
  sleep 3
done
curl --fail --max-time 20 -I https://example.invalid/
curl --fail --max-time 20 -I https://example.invalid/
curl --fail --max-time 20 -I https://example.invalid/minio/health/live
curl --fail --max-time 20 -I https://openai6.cn/
dc ps
