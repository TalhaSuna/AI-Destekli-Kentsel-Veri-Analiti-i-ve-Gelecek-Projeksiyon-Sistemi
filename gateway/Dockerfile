FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o gateway .

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/gateway .
EXPOSE 9000
CMD ["./gateway"]
