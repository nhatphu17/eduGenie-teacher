# EduGenie Teacher

**AI Assistant giúp giáo viên soạn đề – chấm bài – giáo án nhanh gấp 10 lần**

EduGenie Teacher is an AI-powered teaching assistant designed specifically for THCS teachers (grades 6-9) to reduce workload while maintaining full pedagogical control.

## 🎯 Core Features

- **Question Bank**: Create & manage question banks with metadata
- **AI Exam Generator**: Generate exams using RAG (Retrieval Augmented Generation)
- **Exam Mixer**: Generate multiple exam versions with shuffled questions
- **Grading**: Auto-grade MCQ submissions
- **Lesson Plan Generator**: Generate MOET-compliant lesson plans
- **Export**: Word, PDF, Excel formats
- **Subscription Management**: FREE and PRO plans with quota enforcement

## 🏗️ Tech Stack

### Backend
- **NestJS** - REST API framework
- **Prisma** - ORM with MySQL
- **JWT** - Authentication
- **OpenAI GPT-4o** - AI generation
- **OpenAI Embeddings** - Vector search for RAG

### Frontend
- **React** + **TypeScript**
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **PWA** - Service Worker, offline support

## 📋 Prerequisites

- Node.js 18+ and npm
- MySQL 8.0+
- OpenAI API key

## 🚀 Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup

1. Create a MySQL database:
```sql
CREATE DATABASE edugenie_teacher;
```

2. Configure database connection in `backend/.env`:
```env
DATABASE_URL="mysql://user:password@localhost:3306/edugenie_teacher?schema=public"
```

3. Run Prisma migrations:
```bash
cd backend
npx prisma migrate dev --name init
```

4. Seed the database:
```bash
npm run prisma:seed
```

This will create:
- Subscription plans (FREE, PRO)
- Subjects for THCS (grades 6-9)

### 3. Backend Configuration

Create `backend/.env` file:

```env
# Database
DATABASE_URL="mysql://user:password@localhost:3306/edugenie_teacher?schema=public"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Server
PORT=3001
FRONTEND_URL=http://localhost:3000

# Environment
NODE_ENV=development
```

### 4. Frontend Configuration

Create `frontend/.env` file (optional):

```env
VITE_API_URL=http://localhost:3001/api
```

### 5. Run the Application

**Development mode:**

```bash
# Terminal 1: Backend
cd backend
npm run start:dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/api/docs

## 📚 API Documentation

Once the backend is running, visit http://localhost:3001/api/docs for Swagger API documentation.

## 🗄️ Database Schema

The Prisma schema includes:

- **User**: Teachers and admins
- **SubscriptionPlan**: FREE and PRO plans
- **Subject**: Subjects for THCS
- **Document**: Uploaded documents with embeddings
- **Question**: Question bank items
- **Exam**: Generated exams
- **LessonPlan**: Generated lesson plans
- **AIUsageLog**: Usage tracking

## 🔐 Authentication

- Register a new account at `/register`
- Login at `/login`
- JWT tokens are stored in localStorage
- All API calls include Bearer token in Authorization header

## 🤖 AI Architecture (RAG)

The system uses a strict RAG (Retrieval Augmented Generation) pipeline:

1. **Document Ingestion**: Documents are chunked and embedded
2. **Retrieval**: Relevant chunks retrieved using vector similarity
3. **Generation**: AI generates content ONLY from retrieved chunks
4. **Safety**: No external knowledge allowed, citations required

### Key Safety Features:
- ✅ Quota enforced BEFORE AI calls
- ✅ No relevant data → Error returned
- ✅ Structured JSON output
- ✅ Confidence scores included

## 📦 Subscription Plans

- **FREE**: 5 daily, 50 monthly AI generations
- **PRO**: 50 daily, 1000 monthly AI generations (199,000 VND/month)

Quotas are strictly enforced at the backend API level.

## 🎨 Branding

- **Colors**: Blue (primary) + Orange (accent)
- **Mascot**: Academic genie
- **Style**: Clean, modern, friendly SaaS

## 📝 Development

### Backend Commands

```bash
cd backend

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Open Prisma Studio
npm run prisma:studio

# Seed database
npm run prisma:seed
```

### Frontend Commands

```bash
cd frontend

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🚢 Deployment

### Backend Deployment

1. Set environment variables on your hosting platform
2. Run migrations: `npm run prisma:migrate`
3. Build: `npm run build`
4. Start: `npm run start:prod`

### Frontend Deployment

1. Build: `npm run build`
2. Deploy `dist/` folder to static hosting (Vercel, Netlify, etc.)
3. Configure API URL in environment variables

## 🔒 Security Notes

- Change `JWT_SECRET` in production
- Use strong database passwords
- Keep OpenAI API key secure
- Enable HTTPS in production
- Implement rate limiting for production

## 📄 License

Private - All rights reserved

## 🤝 Support

For issues or questions, please contact the development team.

---

**Built with ❤️ for Vietnamese THCS Teachers**

