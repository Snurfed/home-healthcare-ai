# Home Health Care AI Assistant

A HIPAA-compliant healthcare application for home health agencies, featuring voice-to-text documentation, OASIS assessment automation, and patient management. Built with Node.js/Express backend, React frontend, and React Native mobile app.

## Table of Contents

- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Technology Stack](#technology-stack)
- [Security & Compliance](#security--compliance)
- [Next Steps](#next-steps)

## Project Structure

```
HomeHealthCareAIAssistant/
├── backend/                      # Node.js/Express API server
│   ├── src/
│   │   ├── config/              # Database, auth, app configuration
│   │   ├── controllers/         # Request handlers
│   │   ├── middleware/          # Auth, logging, error handling
│   │   ├── models/              # Database models
│   │   ├── routes/              # API route definitions
│   │   │   ├── auth.ts          # Authentication routes
│   │   │   ├── patients.ts      # Patient management routes
│   │   │   ├── voice.ts         # Voice-to-text routes
│   │   │   ├── documents.ts     # Document management routes
│   │   │   └── oasis.ts         # OASIS assessment routes
│   │   ├── services/            # Business logic
│   │   ├── utils/               # Helper functions
│   │   └── validators/          # Input validation
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   ├── .env.example             # Environment variables template
│   ├── package.json
│   └── tsconfig.json
├── frontend/                     # React web application
│   ├── src/
│   │   ├── assets/              # Images, styles
│   │   ├── components/          # Reusable UI components
│   │   ├── context/             # React context providers
│   │   ├── hooks/               # Custom hooks
│   │   ├── pages/               # Page components
│   │   ├── services/            # API client
│   │   ├── types/               # TypeScript types
│   │   └── utils/               # Helper functions
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
├── mobile/                       # React Native mobile app
│   ├── src/
│   │   ├── assets/              # Images, fonts
│   │   ├── components/          # Reusable components
│   │   ├── context/             # React context
│   │   ├── hooks/               # Custom hooks
│   │   ├── navigation/          # Navigation config
│   │   ├── screens/             # Screen components
│   │   ├── services/            # API client
│   │   ├── types/               # TypeScript types
│   │   └── utils/               # Helper functions
│   ├── ios/
│   ├── android/
│   ├── tests/
│   └── package.json
├── shared/                       # Shared code across all apps
│   ├── constants/
│   ├── types/
│   └── utils/
├── docs/
│   ├── api/                     # API documentation
│   ├── architecture/            # System design docs
│   └── compliance/              # HIPAA compliance docs
└── scripts/                      # Build/deploy scripts
```

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 or **yarn** >= 1.22.0
- **PostgreSQL** >= 14.0 (for production)
- **Redis** (optional, for session caching)
- **Xcode** (for iOS development)
- **Android Studio** (for Android development)

## Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd HomeHealthCareAIAssistant
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 4. Install Mobile Dependencies

```bash
cd mobile
npm install

# For iOS (macOS only)
npm run pod-install
```

## Environment Configuration

### Backend Configuration

1. Copy the example environment file:

```bash
cd backend
cp .env.example .env
```

2. Configure the required environment variables in `.env`:

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `home_health_care_db` |
| `DB_USER` | Database user | `your_user` |
| `DB_PASSWORD` | Database password | `your_password` |
| `JWT_ACCESS_SECRET` | JWT signing secret (min 32 chars) | `your_secret_key` |
| `JWT_REFRESH_SECRET` | Refresh token secret | `your_refresh_secret` |

#### Voice-to-Text Services (choose one)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLOUD_PROJECT_ID` | Google Cloud project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON |
| `AWS_ACCESS_KEY_ID` | AWS access key (for Transcribe) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `OPENAI_API_KEY` | OpenAI API key (for Whisper) |

#### File Storage (choose one)

| Variable | Description |
|----------|-------------|
| `S3_BUCKET_NAME` | AWS S3 bucket name |
| `S3_REGION` | AWS region |
| `AZURE_STORAGE_ACCOUNT` | Azure storage account |
| `GCS_BUCKET_NAME` | Google Cloud Storage bucket |

#### EMR Integration (optional)

| Variable | Description |
|----------|-------------|
| `FHIR_BASE_URL` | FHIR server endpoint |
| `EMR_CLIENT_ID` | EMR OAuth client ID |
| `EMR_CLIENT_SECRET` | EMR OAuth client secret |

See `backend/.env.example` for the complete list of configuration options.

## Running the Application

### Backend Development Server

```bash
cd backend
npm run dev
```

The API server will start at `http://localhost:3000`

### Backend Production Build

```bash
cd backend
npm run build
npm start
```

### Frontend Development Server

```bash
cd frontend
npm run dev
```

The web app will start at `http://localhost:5173`

### Mobile Development

```bash
cd mobile

# iOS
npm run ios

# Android
npm run android
```

### Running Tests

```bash
# Backend tests
cd backend
npm test
npm run test:coverage

# Frontend tests
cd frontend
npm test
npm run test:coverage

# Mobile tests
cd mobile
npm test
```

## API Endpoints

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health status |

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register new user |
| POST | `/login` | Authenticate user |
| POST | `/refresh-token` | Refresh access token |
| POST | `/logout` | Logout user |
| GET | `/me` | Get current user info |

### Patients (`/api/patients`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List patients (paginated) |
| GET | `/:id` | Get patient by ID |
| POST | `/` | Create new patient |
| PUT | `/:id` | Update patient |
| DELETE | `/:id` | Soft delete patient |

### Voice-to-Text (`/api/voice`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/transcribe` | Transcribe audio to text |
| POST | `/process-oasis` | Transcribe & auto-populate OASIS |
| GET | `/transcriptions/:id` | Get transcription by ID |

### Documents (`/api/documents`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload document |
| GET | `/` | List documents (filtered) |
| GET | `/:id` | Get document by ID |
| DELETE | `/:id` | Soft delete document |
| POST | `/:id/ocr` | Extract text via OCR |

### OASIS Assessments (`/api/oasis`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/assessments` | List assessments |
| GET | `/assessments/:id` | Get assessment by ID |
| POST | `/assessments` | Create new assessment |
| PUT | `/assessments/:id` | Update assessment |
| POST | `/assessments/:id/submit` | Submit for review |
| GET | `/questions` | Get OASIS question library |

## Technology Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL
- **Authentication:** JWT (access + refresh tokens)
- **Security:** Helmet, CORS, rate limiting
- **Logging:** Winston, Morgan

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **Language:** TypeScript
- **State Management:** Zustand, React Query
- **Styling:** Tailwind CSS
- **Forms:** React Hook Form + Zod
- **Routing:** React Router

### Mobile
- **Framework:** React Native 0.73
- **Language:** TypeScript
- **Navigation:** React Navigation
- **State Management:** Zustand, React Query
- **Secure Storage:** react-native-encrypted-storage, react-native-keychain

## Security & Compliance

This application is designed for HIPAA compliance:

### Data Protection
- All PHI encrypted at rest (AES-256)
- TLS 1.3 for data in transit
- Secure credential storage on mobile devices
- PHI-aware document categorization

### Access Control
- Role-based access control (RBAC)
- JWT authentication with short-lived access tokens
- Audit logging for all PHI access
- Session timeout and refresh token rotation

### Security Features
- Helmet.js security headers
- CORS configuration
- Rate limiting (general + auth-specific)
- Input validation and sanitization
- SQL injection prevention

### Compliance Features
- HIPAA audit trail logging
- Document retention policies
- Soft deletes (no permanent PHI deletion)
- Access logging with IP tracking

## Next Steps

### Backend Implementation
- [ ] Database models and migrations (PostgreSQL/Prisma)
- [ ] Authentication middleware with JWT validation
- [ ] Controller implementations for all routes
- [ ] Voice-to-text service integration (Google/AWS/OpenAI)
- [ ] OCR service integration
- [ ] EMR/FHIR integration service
- [ ] File upload to S3/Azure/GCS
- [ ] HIPAA audit logging service
- [ ] Unit and integration tests

### Frontend Implementation
- [ ] Project scaffolding with Vite
- [ ] Authentication pages (login, register)
- [ ] Dashboard layout and navigation
- [ ] Patient list and detail views
- [ ] OASIS assessment form components
- [ ] Document upload and viewer
- [ ] Voice recording interface
- [ ] Real-time transcription display
- [ ] Responsive design for tablets

### Mobile Implementation
- [ ] React Native project initialization
- [ ] Authentication flow with secure storage
- [ ] Offline-first architecture
- [ ] Voice recording and upload
- [ ] Camera integration for document capture
- [ ] Push notifications for assignments
- [ ] Biometric authentication
- [ ] Background sync for offline visits

### DevOps & Infrastructure
- [ ] Docker containerization
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Staging and production environments
- [ ] Database backup automation
- [ ] Log aggregation (CloudWatch/Datadog)
- [ ] Performance monitoring
- [ ] HIPAA-compliant cloud hosting

## License

UNLICENSED - Proprietary software. All rights reserved.

## Support

For questions or issues, please contact the development team.
