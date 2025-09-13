# Travel API Setup Guide

## Prerequisites

1. **Node.js** (version 18 or higher)
2. **Supabase Account** - Sign up at [supabase.com](https://supabase.com)
3. **Postman** (optional, for API testing)

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# Supabase Configuration
SUPABASE_URL=your-supabase-project-url
SUPABASE_KEY=your-supabase-anon-key

# Browserless Configuration (for RateHawk)
BROWSERLESS_TOKEN=your-browserless-token
BROWSERLESS_ENDPOINT=wss://chrome.browserless.io?token=your-token
```

### 3. Set Up Supabase Database

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the SQL from `src/db/schema.sql`:

```sql
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone_number VARCHAR(20),
    agency_name VARCHAR(255),
    legal_name VARCHAR(255),
    city VARCHAR(100),
    address TEXT,
    actual_address_matches BOOLEAN DEFAULT true,
    itn VARCHAR(100),
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create an index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);
```

#### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run the schema
supabase db reset
```

### 4. Set Up Supabase Storage (for logo uploads)

1. Go to your Supabase project dashboard
2. Navigate to Storage
3. Create a new bucket called "logos"
4. Set the bucket to public

### 5. Start the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3001`

## API Endpoints

### User Management

- `POST /api/user/users` - Create a new user
- `GET /api/user/users` - Get all users

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify JWT token
- `GET /api/auth/profile` - Get user profile

### RateHawk Integration

- `POST /api/ratehawk/login` - Login to RateHawk
- `POST /api/ratehawk/search` - Search hotels
- `GET /api/ratehawk/session/:userId` - Check session status
- `POST /api/ratehawk/logout/:userId` - Logout from RateHawk

### Health Check

- `GET /api/health` - Server health status

## Testing the API

### Using the Test Script

```bash
node test-user-api.js
```

### Using Postman

1. Import the `Travel-API.postman_collection.json` file
2. Set the `base_url` variable to `http://localhost:3001`
3. Run the requests

### Using curl

#### Create a User
```bash
curl -X POST http://localhost:3001/api/user/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "User",
    "agency_name": "Test Agency",
    "city": "New York"
  }'
```

#### Get All Users
```bash
curl -X GET http://localhost:3001/api/user/users
```

#### Health Check
```bash
curl -X GET http://localhost:3001/api/health
```

## Troubleshooting

### Common Issues

1. **Supabase Connection Error**
   - Check your `SUPABASE_URL` and `SUPABASE_KEY` in `.env`
   - Ensure your Supabase project is active

2. **Module Import Errors**
   - Make sure all dependencies are installed: `npm install`
   - Check that you're using the correct import/require syntax

3. **Database Table Not Found**
   - Run the SQL schema in your Supabase dashboard
   - Check that the table name is exactly "users"

4. **File Upload Issues**
   - Ensure the "logos" bucket exists in Supabase Storage
   - Check that the bucket is set to public

### Logs

Check the console output for detailed error messages. The server logs all requests and errors with timestamps.

## Development

### Project Structure

```
travelapi/
├── config/
│   ├── database.js          # SQLite configuration
│   └── supabaseClient.js    # Supabase configuration
├── routes/
│   ├── auth.js              # Authentication routes
│   └── ratehawk.js          # RateHawk integration routes
├── src/
│   ├── controllers/
│   │   └── userController.js # User management controller
│   ├── models/
│   │   └── userModel.js     # User data model
│   ├── routes/
│   │   └── userRoutes.js    # User routes
│   └── db/
│       └── schema.sql       # Database schema
├── services/                # Business logic services
├── server.js               # Main server file
└── test-user-api.js        # Test script
```

### Adding New Features

1. Create new routes in the appropriate route file
2. Add controller functions for business logic
3. Update models for data operations
4. Test with the provided test script or Postman

