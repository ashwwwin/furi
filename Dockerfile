# Use Ubuntu base image
FROM ubuntu:22.04

# Install system dependencies, Node.js, and Bun
USER root
RUN apt-get update && apt-get install -y \
    curl \
    git \
    unzip \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 23.x via NodeSource repository
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_23.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Bun globally in /usr/local/bin
RUN curl -fsSL https://bun.sh/install | bash && \
    mv /root/.bun/bin/bun /usr/local/bin/bun && \
    chmod +x /usr/local/bin/bun && \
    rm -rf /root/.bun

# Install PM2, TypeScript, pnpm, yarn and related tools globally with npm
RUN npm install -g pm2 typescript tsx ts-node @swc/core pnpm yarn

# Create node user and home directory
RUN useradd -m -s /bin/bash node
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

# Create /data directory and set permissions for node user
USER root
RUN mkdir -p /data/installed /data/transport && \
    chown -R node:node /data && \
    chmod -R 755 /data

RUN echo "alias furi='bun run /home/node/.furikake/index.ts'" \
    >> /etc/bash.bashrc    
    
# Switch back to node user
USER node

# Create initial configuration.json if it doesn't exist
RUN echo '{"installed": {}}' > /data/configuration.json

# Set environment variables for HTTP server
ENV PORT=9339
ENV EXPOSE_SUDO=true
ENV BASE_PATH=/home/node/.furikake
ENV USERDATA_PATH=/data

# Expose port (http & aggregator sse)
EXPOSE 9339
# EXPOSE 9338

CMD ["bun", "/home/node/.furikake/app/http/server/routes.ts"]