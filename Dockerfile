# Use Node.js 23.11 base image
FROM node:23.11

# Install system dependencies and Bun
USER root
RUN apt-get update && apt-get install -y \
    curl \
    git \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Bun globally in /usr/local/bin
RUN curl -fsSL https://bun.sh/install | bash && \
    mv /root/.bun/bin/bun /usr/local/bin/bun && \
    chmod +x /usr/local/bin/bun && \
    rm -rf /root/.bun

# Install PM2, TypeScript and related tools globally with npm
RUN npm install -g pm2 typescript tsx ts-node @swc/core

# Create node user home directory and switch to node user
RUN mkdir -p /home/node
USER node
WORKDIR /home/node

# Set up git configuration for the node user
RUN git config --global user.name "Furi" && \
    git config --global user.email "kake@furi.so" && \
    git config --global init.defaultBranch main

# Clone and build Furikake directly
RUN git clone https://github.com/ashwwwin/furi.git .furikake && \
    cd .furikake && \
    bun install

# Create necessary directories for furi package management
RUN mkdir -p /home/node/.furikake/installed

# Create configuration.json
RUN echo '{"installed": {}}' > /home/node/.furikake/configuration.json

# Set environment variables for HTTP server
ENV PORT=9339
ENV EXPOSE_SUDO=true
ENV BASE_PATH=/home/node/.furikake

# Expose port (http & aggregator sse)
EXPOSE 9339
EXPOSE 9338

# Create a startup script that ensures environment variables are loaded
RUN echo '#!/bin/bash\nset -e\necho "Environment variables at startup:"\nenv | grep -E "(HTTP_AUTH_TOKEN|PORT|EXPOSE_SUDO)" || echo "No matching env vars found"\nexec "$@"' > /home/node/start.sh && \
    chmod +x /home/node/start.sh

# Start Furikake HTTP server with environment variable debugging
CMD ["/home/node/start.sh", "bun", "/home/node/.furikake/app/http/server/routes.ts"]