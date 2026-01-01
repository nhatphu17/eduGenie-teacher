# Troubleshooting Installation Issues

## esbuild Installation Error on macOS

If you encounter the esbuild installation error (`Unknown system error -88`), try these solutions:

### Solution 1: Clean Install
```bash
# Remove node_modules and lock files
rm -rf node_modules package-lock.json

# Clear npm cache
npm cache clean --force

# Reinstall
npm install
```

### Solution 2: Use Node Version Manager
```bash
# If using nvm, ensure you're on a compatible Node version
nvm use 20
npm install
```

### Solution 3: Install esbuild explicitly
```bash
npm install --save-dev esbuild@^0.19.12
npm install
```

### Solution 4: Use yarn instead
```bash
# Remove node_modules
rm -rf node_modules

# Install yarn if not installed
npm install -g yarn

# Install with yarn
yarn install
```

### Solution 5: Architecture-specific install (M1/M2 Mac)
```bash
# For Apple Silicon Macs
arch -arm64 npm install

# Or set environment variable
export npm_config_arch=arm64
npm install
```

### Solution 6: Use pnpm
```bash
# Install pnpm
npm install -g pnpm

# Install dependencies
pnpm install
```

## General Installation Issues

### Clear all caches
```bash
# Clear npm cache
npm cache clean --force

# Clear node_modules
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Check Node version
```bash
node --version  # Should be 18+ or 20+
```

### Permission issues
```bash
# Fix npm permissions (if needed)
sudo chown -R $(whoami) ~/.npm
```

