# 🔄 Database Migration Plan: Current → New Schema

## 📊 Current vs New Schema

### Current Problems:
1. ❌ Document stores full content → Cannot filter by chapter
2. ❌ Embedding on full document → Inaccurate search
3. ❌ Question has no source reference → Cannot trace
4. ❌ No job tracking → No way to show progress

### Migration Strategy:

```
Current Schema              →  New Schema
─────────────────────────────────────────────────
Document                    →  Document (metadata only)
├─ content (LONGTEXT)       →  ├─ title, author, etc.
└─ embedding (JSON)         →  └─ status, filePath
                            →  
                            →  Chunk (NEW)
                            →  ├─ content
                            →  ├─ embedding
                            →  ├─ chapterNumber
                            →  └─ metadata
                            →  
Question                    →  Question (enhanced)
└─ (no source)              →  ├─ sourceChunkId
                            →  ├─ chapterNumber
                            →  └─ source metadata
                            →  
                            →  ProcessingJob (NEW)
                            →  └─ Track async operations
```

---

## 🎯 Migration Steps

### Step 1: Create New Tables (Non-breaking)

```prisma
// Add new models WITHOUT removing old ones
model Chunk {
  id              String       @id @default(cuid())
  documentId      String
  // ... full schema from ROADMAP_UPGRADE.md
  @@map("chunks")
}

model ProcessingJob {
  id              String       @id @default(cuid())
  // ... full schema
  @@map("processing_jobs")
}
```

Run migration:
```bash
npx prisma migrate dev --name add_chunks_and_jobs
```

### Step 2: Update Document Model (Add new fields, keep old)

```prisma
model Document {
  // Old fields (keep for now)
  content         String?       @db.LongText  // Make nullable
  embedding       Json?         // Keep for backward compat
  chunkIndex      Int?
  
  // New fields
  title           String?
  author          String?
  publisher       String?
  publishYear     Int?
  edition         String?
  totalChapters   Int?
  totalPages      Int?
  filePath        String?
  fileSize        Int?
  mimeType        String?
  status          ProcessingStatus? @default(PENDING)
  processedAt     DateTime?
  errorMessage    String?
  
  // New relation
  chunks          Chunk[]
  
  // ... rest
}

enum ProcessingStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  PARTIALLY_COMPLETED
}
```

### Step 3: Update Question Model (Add source tracking)

```prisma
model Question {
  // Existing fields
  id              String       @id @default(cuid())
  // ...
  
  // New fields for source tracking
  sourceChunkId   String?
  sourceChunk     Chunk?       @relation(fields: [sourceChunkId], references: [id])
  sourceDocument  String?
  chapterNumber   Int?
  chapterTitle    String?
  pageNumber      Int?
  
  // New metadata
  generatedBy     GenerationMethod? @default(AI)
  aiPrompt        String?      @db.LongText
  aiConfidence    Float?
  status          QuestionStatus? @default(DRAFT)
  
  bloomLevel      String?
  timeEstimate    Int?
  topics          String[]
  keywords        String[]
  
  reviewedBy      String?
  reviewer        User?        @relation("QuestionReviewer", fields: [reviewedBy], references: [id])
  reviewedAt      DateTime?
  
  // ... rest
}

enum GenerationMethod {
  AI
  MANUAL
  IMPORTED
  MIXED
}

enum QuestionStatus {
  DRAFT
  REVIEWED
  PUBLISHED
  ARCHIVED
}
```

### Step 4: Update Exam Model (Add scope)

```prisma
model Exam {
  // Existing fields
  id              String       @id @default(cuid())
  // ...
  
  // New scope fields
  scope           ExamScope?    @default(SINGLE_CHAPTER)
  targetChapters  Int[]
  chapterDistribution Json?
  difficultyDistribution Json?
  typeDistribution Json?
  status          ExamStatus?   @default(DRAFT)
  publishedAt     DateTime?
  
  // ... rest
}

enum ExamScope {
  SINGLE_CHAPTER
  MULTI_CHAPTER
  MIDTERM
  FINAL
  FULL_BOOK
}

enum ExamStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

### Step 5: Update LessonPlan Model (Add structure)

```prisma
model LessonPlan {
  // Existing fields
  id              String       @id @default(cuid())
  // ...
  
  // New structured fields
  chapterNumber   Int?
  chapterTitle    String?
  lessonNumber    Int?
  lessonTitle     String?
  
  duration        Int?         // Minutes
  objectives      Json?        // {knowledge: [], skills: [], attitude: []}
  teachingMethods Json?
  materials       String[]
  
  warmUp          String?      @db.LongText
  teacherActivities String?    @db.LongText
  studentActivities String?    @db.LongText
  homework        String?      @db.LongText
  
  suggestedQuestions String[]  // Question IDs
  sourceChunks    String[]     // Chunk IDs
  
  status          LessonPlanStatus? @default(DRAFT)
  
  // ... rest
}

enum LessonPlanStatus {
  DRAFT
  REVIEWED
  PUBLISHED
  ARCHIVED
}
```

### Step 6: Update AIUsageLog (Add context tracking)

```prisma
model AIUsageLog {
  // Rename from aIUsageLog to aiUsageLog
  // Existing fields
  id              String       @id @default(cuid())
  // ...
  
  // New context fields
  subjectId       String?
  chapterNumber   Int?
  scope           String?      // "chapter-2", "full-book"
  
  inputTokens     Int?
  outputTokens    Int?
  model           String?      @default("gpt-4o")
  cost            Float?
  duration        Int?
  
  prompt          String?      @db.LongText
  response        String?      @db.LongText
  
  @@index([chapterNumber])
  // ... rest
  
  @@map("ai_usage_logs")  // Rename table
}
```

---

## 🔄 Data Migration Script

Create a migration script to convert existing data:

```typescript
// prisma/migrations/migrate-to-chunks.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateDocumentsToChunks() {
  console.log('🔄 Starting document-to-chunk migration...');
  
  // Get all existing documents
  const documents = await prisma.document.findMany({
    where: {
      content: { not: null },
    },
  });
  
  console.log(`Found ${documents.length} documents to migrate`);
  
  for (const doc of documents) {
    try {
      console.log(`Migrating document ${doc.id}...`);
      
      // Create a single chunk from the old document
      // In production, you'd want to re-process with Python service
      await prisma.chunk.create({
        data: {
          documentId: doc.id,
          content: doc.content,
          embedding: doc.embedding,
          chunkIndex: doc.chunkIndex || 0,
          contentLength: doc.content?.length || 0,
          chunkType: 'TEXT',
          // Leave chapter info as NULL - needs re-processing
        },
      });
      
      // Update document metadata
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          title: doc.originalFileName || 'Untitled',
          status: 'PARTIALLY_COMPLETED', // Needs re-processing
          // Keep old content for now (can delete later)
        },
      });
      
      console.log(`✅ Migrated document ${doc.id}`);
    } catch (error) {
      console.error(`❌ Failed to migrate document ${doc.id}:`, error);
    }
  }
  
  console.log('✅ Migration completed');
}

async function main() {
  await migrateDocumentsToChunks();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Run migration:
```bash
npx ts-node prisma/migrations/migrate-to-chunks.ts
```

---

## 🧪 Testing Migration

### 1. Verify data integrity:

```typescript
// Test script
async function verifyMigration() {
  // Check all documents have at least one chunk
  const docsWithoutChunks = await prisma.document.findMany({
    where: {
      chunks: { none: {} },
      content: { not: null },
    },
  });
  
  if (docsWithoutChunks.length > 0) {
    console.error(`❌ ${docsWithoutChunks.length} documents have no chunks`);
  } else {
    console.log('✅ All documents have chunks');
  }
  
  // Check chunk embeddings
  const chunksWithoutEmbeddings = await prisma.chunk.findMany({
    where: { embedding: null },
  });
  
  console.log(`⚠️  ${chunksWithoutEmbeddings.length} chunks need embeddings`);
}
```

### 2. Test backward compatibility:

```typescript
// Ensure old APIs still work
async function testBackwardCompat() {
  // Test getting documents
  const docs = await prisma.document.findMany({
    include: { chunks: true },
  });
  
  console.log(`Loaded ${docs.length} documents with chunks`);
  
  // Test search (should work with chunks now)
  // ... test existing search endpoints
}
```

---

## 📋 Rollout Plan

### Phase 1: Schema Update (Week 1)
- [x] Design new schema
- [ ] Create Prisma migrations
- [ ] Test on dev environment
- [ ] Review with team

### Phase 2: Deploy New Schema (Week 1-2)
- [ ] Deploy migration to staging
- [ ] Run data migration script
- [ ] Verify data integrity
- [ ] Test all existing features

### Phase 3: Gradual Feature Rollout (Week 2-3)
- [ ] Update document upload to use new Chunk model
- [ ] Update search to query Chunks instead of Documents
- [ ] Update exam generator to filter by chapter
- [ ] Add job tracking UI

### Phase 4: Cleanup (Week 3-4)
- [ ] Remove old Document.content field (after confirming all migrated)
- [ ] Remove old code paths
- [ ] Update documentation
- [ ] Final testing

### Phase 5: Re-processing (Optional, Week 4+)
- [ ] Run Python service on all existing documents
- [ ] Generate proper chapter metadata
- [ ] Update chunk embeddings
- [ ] Mark documents as COMPLETED

---

## 🚨 Rollback Plan

If migration fails:

```bash
# 1. Rollback database
npx prisma migrate resolve --rolled-back <migration-name>

# 2. Restore from backup
mysql -u user -p database < backup.sql

# 3. Redeploy previous version of code
git checkout <previous-tag>
npm run build
pm2 restart all
```

---

## ✅ Migration Checklist

### Pre-migration:
- [ ] Backup production database
- [ ] Test migration on staging
- [ ] Prepare rollback plan
- [ ] Notify users of maintenance window

### During migration:
- [ ] Run schema migration
- [ ] Run data migration script
- [ ] Verify data integrity
- [ ] Test critical paths

### Post-migration:
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify user reports
- [ ] Update documentation

---

**Ready to start? Run:**

```bash
cd backend
npx prisma migrate dev --name upgrade_to_chunk_based_storage
```

