-- Enable UUID extension if not already enabled

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the users table

CREATE TABLE users (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                                email VARCHAR(255) NOT NULL UNIQUE,
                                                                            first_name VARCHAR(100),
                                                                                       last_name VARCHAR(100),
                                                                                                 phone_number VARCHAR(20),
                                                                                                              agency_name VARCHAR(255),
                                                                                                                          legal_name VARCHAR(255),
                                                                                                                                     city VARCHAR(100),
                                                                                                                                          address TEXT, actual_address_matches BOOLEAN DEFAULT true,
                                                                                                                                                                                               itn VARCHAR(100),
                                                                                                                                                                                                   logo_url TEXT, created_at TIMESTAMP DEFAULT NOW());

-- Create an index on email for faster lookups

CREATE INDEX idx_users_email ON users(email);

-- Insert some sample data for testing

INSERT INTO users (email, first_name, last_name, agency_name, city)
VALUES ('john.doe@example.com',
        'John',
        'Doe',
        'Travel Agency Inc',
        'New York'), ('jane.smith@example.com',
                      'Jane',
                      'Smith',
                      'Global Travel',
                      'London'), ('mike.wilson@example.com',
                                  'Mike',
                                  'Wilson',
                                  'Adventure Tours',
                                  'Tokyo');