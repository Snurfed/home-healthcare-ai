# Database Setup Guide

This guide walks you through setting up PostgreSQL for the Home Health Care AI Assistant backend.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Install PostgreSQL on macOS](#install-postgresql-on-macos)
3. [Create the Database](#create-the-database)
4. [Configure Environment Variables](#configure-environment-variables)
5. [Run Prisma Migrations](#run-prisma-migrations)
6. [Verify the Setup](#verify-the-setup)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- macOS (this guide is macOS-specific; see [Alternative Installation Methods](#alternative-installation-methods) for other platforms)
- [Homebrew](https://brew.sh/) package manager installed
- Node.js 18+ and npm installed
- Terminal access

---

## Install PostgreSQL on macOS

### Option 1: Using Homebrew (Recommended)

```bash
# Install PostgreSQL 15 (LTS version)
brew install postgresql@15

# Add PostgreSQL to your PATH (add to ~/.zshrc or ~/.bash_profile)
echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Start PostgreSQL service
brew services start postgresql@15

# Verify installation
psql --version
# Should output: psql (PostgreSQL) 15.x
```

### Option 2: Using Postgres.app

1. Download [Postgres.app](https://postgresapp.com/)
2. Move to Applications folder
3. Open Postgres.app and click "Initialize" to create a new server
4. Add to PATH:
   ```bash
   echo 'export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

### Verify PostgreSQL is Running

```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Or connect to the default database
psql postgres -c "SELECT version();"
```

---

## Create the Database

### Step 1: Connect to PostgreSQL

```bash
# Connect as your system user (default superuser on macOS)
psql postgres
```

### Step 2: Create Database and User

Run these SQL commands in the `psql` prompt:

```sql
-- Create a dedicated user for the application
CREATE USER hhc_admin WITH PASSWORD 'your_secure_password_here';

-- Create the database
CREATE DATABASE home_health_care_db OWNER hhc_admin;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE home_health_care_db TO hhc_admin;

-- Connect to the new database to set up schema permissions
\c home_health_care_db

-- Grant schema permissions (required for Prisma)
GRANT ALL ON SCHEMA public TO hhc_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO hhc_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO hhc_admin;

-- Exit psql
\q
```

### Step 3: Verify Database Creation

```bash
# List all databases
psql postgres -c "\l"

# Connect to the new database
psql home_health_care_db -U hhc_admin

# You should see:
# home_health_care_db=>
```

---

## Configure Environment Variables

### Step 1: Copy the Environment Template

```bash
cd backend
cp .env.example .env
```

### Step 2: Configure DATABASE_URL

Open `backend/.env` and set the `DATABASE_URL`:

```env
# Database Configuration
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
DATABASE_URL="postgresql://hhc_admin:your_secure_password_here@localhost:5432/home_health_care_db?schema=public"
```

**URL Components:**
| Component | Value | Description |
|-----------|-------|-------------|
| `hhc_admin` | Username | Database user created above |
| `your_secure_password_here` | Password | Replace with your actual password |
| `localhost` | Host | Database server (localhost for local dev) |
| `5432` | Port | Default PostgreSQL port |
| `home_health_care_db` | Database | Database name created above |
| `schema=public` | Schema | Default schema |

### Step 3: Configure JWT Secrets

Generate secure random secrets for JWT tokens:

```bash
# Generate a 64-character random string for access token secret
openssl rand -base64 48

# Generate another for refresh token secret
openssl rand -base64 48
```

Add these to your `backend/.env`:

```env
# JWT Configuration
JWT_ACCESS_SECRET="paste_your_first_generated_secret_here"
JWT_REFRESH_SECRET="paste_your_second_generated_secret_here"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
```

### Step 4: Complete .env Configuration

Here's a minimal working `.env` configuration:

```env
# ===========================================
# DATABASE
# ===========================================
DATABASE_URL="postgresql://hhc_admin:your_secure_password_here@localhost:5432/home_health_care_db?schema=public"

# ===========================================
# JWT AUTHENTICATION
# ===========================================
JWT_ACCESS_SECRET="your-64-char-access-secret-generated-with-openssl"
JWT_REFRESH_SECRET="your-64-char-refresh-secret-generated-with-openssl"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# ===========================================
# SERVER
# ===========================================
NODE_ENV="development"
PORT=3000
API_VERSION="v1"

# ===========================================
# CORS
# ===========================================
CORS_ALLOWED_ORIGINS="http://localhost:5173,http://localhost:3000"

# ===========================================
# RATE LIMITING
# ===========================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Run Prisma Migrations

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

### Step 2: Generate Prisma Client

```bash
npx prisma generate
```

This creates the TypeScript client in `src/generated/prisma/`.

### Step 3: Create and Run Migrations

```bash
# Create the initial migration
npx prisma migrate dev --name init

# This will:
# 1. Create a new migration file in prisma/migrations/
# 2. Apply the migration to your database
# 3. Regenerate the Prisma Client
```

You should see output like:

```
Applying migration `20240115000000_init`

The following migration(s) have been applied:

migrations/
  └─ 20240115000000_init/
    └─ migration.sql

Your database is now in sync with your schema.
```

### Step 4: Verify Tables Were Created

```bash
# Connect to database and list tables
psql home_health_care_db -U hhc_admin -c "\dt"
```

You should see all 15+ tables:

```
              List of relations
 Schema |        Name         | Type  |  Owner
--------+---------------------+-------+----------
 public | AuditLog            | table | hhc_admin
 public | CarePlan            | table | hhc_admin
 public | Document            | table | hhc_admin
 public | EmergencyContact    | table | hhc_admin
 public | Episode             | table | hhc_admin
 public | Insurance           | table | hhc_admin
 public | OasisAssessment     | table | hhc_admin
 public | OasisQuestion       | table | hhc_admin
 public | OasisResponse       | table | hhc_admin
 public | Patient             | table | hhc_admin
 public | PatientAssignment   | table | hhc_admin
 public | RefreshToken        | table | hhc_admin
 public | SystemConfig        | table | hhc_admin
 public | User                | table | hhc_admin
 public | Visit               | table | hhc_admin
 public | VoiceTranscription  | table | hhc_admin
 public | _prisma_migrations  | table | hhc_admin
```

---

## Verify the Setup

### Start the Development Server

```bash
cd backend
npm run dev
```

You should see:

```
╔════════════════════════════════════════════════════════════╗
║  Home Health Care AI Assistant - Backend API               ║
╠════════════════════════════════════════════════════════════╣
║  Status:      Running                                      ║
║  Environment: development                                  ║
║  Port:        3000                                         ║
║  Health:      http://localhost:3000/health                 ║
╚════════════════════════════════════════════════════════════╝
```

### Test the Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "uptime": 5.123
}
```

### Test User Registration

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!",
    "firstName": "Admin",
    "lastName": "User",
    "role": "ADMIN"
  }'
```

Expected response:

```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid-here",
    "email": "admin@example.com",
    "firstName": "Admin",
    "lastName": "User",
    "role": "ADMIN"
  }
}
```

### Test User Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!"
  }'
```

Expected response:

```json
{
  "message": "Login successful",
  "user": { ... },
  "tokens": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "expiresIn": 900
  }
}
```

---

## Troubleshooting

### PostgreSQL Won't Start

```bash
# Check the PostgreSQL log
tail -f /opt/homebrew/var/log/postgresql@15.log

# Try restarting
brew services restart postgresql@15

# Check if port 5432 is in use
lsof -i :5432
```

### Connection Refused

```bash
# Verify PostgreSQL is running
pg_isready -h localhost -p 5432

# Check if listening on correct interface
psql postgres -c "SHOW listen_addresses;"
# Should show: localhost or *
```

### Authentication Failed

```bash
# Reset user password
psql postgres -c "ALTER USER hhc_admin WITH PASSWORD 'new_password';"

# Check pg_hba.conf authentication method
# Location: /opt/homebrew/var/postgresql@15/pg_hba.conf
# Should have: local all all trust (for development)
```

### Prisma Migration Errors

```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# View migration status
npx prisma migrate status

# Generate client without migration
npx prisma generate
```

### "Database does not exist" Error

```bash
# Create database manually
createdb home_health_care_db -O hhc_admin

# Or via psql
psql postgres -c "CREATE DATABASE home_health_care_db OWNER hhc_admin;"
```

### Permission Denied on Schema

```bash
# Connect as superuser and grant permissions
psql postgres -c "GRANT ALL ON SCHEMA public TO hhc_admin;"
psql home_health_care_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO hhc_admin;"
```

---

## Alternative Installation Methods

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create user and database
sudo -u postgres psql
# Then run the CREATE USER and CREATE DATABASE commands
```

### Windows

1. Download installer from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run the installer, set password for `postgres` user
3. Use pgAdmin or psql to create database and user

### Docker

```bash
# Run PostgreSQL in Docker
docker run --name hhc-postgres \
  -e POSTGRES_USER=hhc_admin \
  -e POSTGRES_PASSWORD=your_secure_password_here \
  -e POSTGRES_DB=home_health_care_db \
  -p 5432:5432 \
  -d postgres:15

# DATABASE_URL for Docker
DATABASE_URL="postgresql://hhc_admin:your_secure_password_here@localhost:5432/home_health_care_db?schema=public"
```

---

## Next Steps

After completing this setup:

1. **Seed initial data** (optional):
   ```bash
   npx prisma db seed
   ```

2. **Explore the database** with Prisma Studio:
   ```bash
   npx prisma studio
   ```
   Opens a web UI at http://localhost:5555

3. **Continue development** - the backend is now ready for:
   - Implementing patient, voice, document, and OASIS controllers
   - Building the frontend application
   - Developing the mobile app

---

*For production deployment, see `docs/DEPLOYMENT.md` (coming soon).*
