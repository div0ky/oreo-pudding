# Stage 1: Build stage
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy dependency files first to leverage Docker layer caching
COPY package.json bun.lock ./

# Install dependencies using bun's frozen lockfile flag
RUN bun install --frozen-lockfile

# Copy the rest of the application source code
COPY tsconfig.json ./
COPY src/ ./src
COPY index.ts ./

# Compile the application into a single standalone, minified binary
# This eliminates node_modules, source files, and compilation overhead at startup.
RUN bun build ./index.ts --compile --minify --keep-names --outfile mcp-server

# Stage 2: Minimal runtime stage
FROM alpine:3.20 AS runner

# Install ca-certificates and standard C++ libraries so the server can run and communicate with iCloud CalDAV APIs securely
RUN apk add --no-cache ca-certificates libstdc++ libgcc \
    && addgroup -S mcp \
    && adduser -S mcp -G mcp

WORKDIR /app

# Copy only the compiled binary from the builder stage
COPY --from=builder /app/mcp-server /app/mcp-server

# Run the container as a non-root user for security
USER mcp

# The entrypoint runs our standalone binary
ENTRYPOINT ["/app/mcp-server"]
