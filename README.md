# MedLicensing Backend API

Healthcare Licensing Management System - Backend API

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup PostgreSQL database
# Create database first:
# createdb medlicensing

# 3. Update .env file with your database credentials

# 4. Run database setup
npm run setup-db

# 5. Start server
npm run dev
```

## 📝 Default Admin Credentials

- Email: admin@medlicensing.id
- Password: admin123

**⚠️ Change password after first login!**

## 🔌 API Endpoints

### Auth
- POST /api/auth/login
- POST /api/auth/register

### Leads
- POST /api/leads (submit lead)
- GET /api/leads (get all leads)
- PUT /api/leads/:id (update lead)

### Nakes
- GET /api/nakes (get all nakes)
- GET /api/nakes/:id (get nakes by id)
- POST /api/nakes (add/update nakes)

### Dashboard
- GET /api/dashboard/stats
- GET /api/dashboard/chart/leads-trend

## 🛠️ Tech Stack

- Node.js + Express
- PostgreSQL
- JWT Authentication
- bcryptjs

## 📄 License

MIT
