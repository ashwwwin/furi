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
RUN mkdir -p /home/node/.furikake/installed && \
    mkdir -p /home/node/.furikake/config && \
    mkdir -p /home/node/.furikake/cache

# Create furi executable script
RUN mkdir -p /home/node/.local/bin && \
    echo '#!/usr/bin/env bash\nexec bun /home/node/.furikake/index.ts "$@"' > /home/node/.local/bin/furi && \
    chmod +x /home/node/.local/bin/furi

# Add local bin to PATH
ENV PATH="/home/node/.local/bin:$PATH"

# Expose port (http & aggregator sse)
EXPOSE 9339
EXPOSE 9338

# Start Furikake HTTP server
CMD ["furi", "http", "start", "-p", "9339", "--sudo", "--no-pm2"]