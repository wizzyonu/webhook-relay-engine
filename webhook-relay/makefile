# Makefile

.PHONY: run build test

# Run the app with live reload (Air)
run:
	air

# Build the production binary
build:
	go build -o bin/webhook-relay.exe ./cmd/api/main.go

# Run tests
test:
	go test -v ./...