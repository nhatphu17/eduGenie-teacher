# Installation Guide

## Quick Start

### Option 1: Install Separately (Recommended)

Since we're not using npm workspaces, install dependencies separately:

```bash
# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Option 2: Use the Install Script

```bash
# From root directory
npm run install:all
```

## Troubleshooting

### If you see "Cannot find module" errors:

1. **Clean install backend:**
```bash
cd backend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

2. **Clean install frontend:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### If esbuild fails on macOS:

```bash
cd frontend
npm install --save-dev esbuild@^0.19.12
npm install
```

### If you see workspace errors:

The project doesn't use npm workspaces anymore. Each directory (backend/frontend) has its own `node_modules`. This is simpler and avoids workspace hoisting issues.

## Running the Application

### Backend
```bash
cd backend
npm run start:dev
```

### Frontend (in a new terminal)
```bash
cd frontend
npm run dev
```



