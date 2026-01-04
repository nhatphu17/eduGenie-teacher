#!/bin/bash

echo "🚀 Setting up EduGenie Teacher..."

# Clean any existing installations
echo "🧹 Cleaning existing installations..."
rm -rf backend/node_modules backend/package-lock.json
rm -rf frontend/node_modules frontend/package-lock.json
rm -rf node_modules package-lock.json

# Clear npm cache
echo "🗑️  Clearing npm cache..."
npm cache clean --force

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Backend installation failed!"
    exit 1
fi
cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Frontend installation failed!"
    exit 1
fi
cd ..

echo "✅ Installation complete!"
echo ""
echo "To start the application:"
echo "  Backend:  cd backend && npm run start:dev"
echo "  Frontend: cd frontend && npm run dev"



