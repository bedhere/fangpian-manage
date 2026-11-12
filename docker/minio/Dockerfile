FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git \
  && GOBIN=/out go install github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z

FROM alpine:3.22

COPY --from=builder /out/minio /usr/local/bin/minio

RUN apk add --no-cache ca-certificates \
  && mkdir -p /data \
  && chown -R 1000:1000 /data

USER 1000:1000
EXPOSE 9000 9001
ENTRYPOINT ["/usr/local/bin/minio"]
