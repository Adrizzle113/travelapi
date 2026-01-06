# Frontend Integration Examples

Real-world code examples for integrating the Travel Booking API with different frameworks.

## Table of Contents

1. [Vanilla JavaScript](#vanilla-javascript)
2. [React](#react)
3. [Vue.js](#vuejs)
4. [Next.js](#nextjs)
5. [Common Utilities](#common-utilities)

---

## Vanilla JavaScript

### Complete Booking Flow

```html
<!DOCTYPE html>
<html>
<head>
  <title>Hotel Booking</title>
</head>
<body>
  <div id="app">
    <input id="destination-search" type="text" placeholder="Search destination...">
    <div id="destinations"></div>

    <input id="checkin" type="date">
    <input id="checkout" type="date">
    <button onclick="searchHotels()">Search Hotels</button>

    <div id="hotels"></div>
  </div>

  <script>
    const API_BASE = 'http://localhost:3001/api';
    let authToken = localStorage.getItem('auth_token');

    // Auto-login for testing
    async function login() {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'test123456'
        })
      });

      const data = await response.json();
      if (data.success) {
        authToken = data.token;
        localStorage.setItem('auth_token', data.token);
        console.log('✅ Logged in');
      }
    }

    // Destination autocomplete
    let searchTimeout;
    document.getElementById('destination-search').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value;

      if (query.length < 2) return;

      searchTimeout = setTimeout(async () => {
        const response = await fetch(
          `${API_BASE}/destinations/autocomplete?query=${query}`
        );
        const data = await response.json();

        const container = document.getElementById('destinations');
        container.innerHTML = data.results.map(dest => `
          <div onclick="selectDestination('${dest.id}', '${dest.display_name}')">
            ${dest.display_name}
          </div>
        `).join('');
      }, 300);
    });

    let selectedDestination = null;

    function selectDestination(id, name) {
      selectedDestination = id;
      document.getElementById('destination-search').value = name;
      document.getElementById('destinations').innerHTML = '';
    }

    // Search hotels
    async function searchHotels() {
      if (!selectedDestination) {
        alert('Please select a destination');
        return;
      }

      const checkin = document.getElementById('checkin').value;
      const checkout = document.getElementById('checkout').value;

      if (!checkin || !checkout) {
        alert('Please select dates');
        return;
      }

      const guests = JSON.stringify([{ adults: 2, children: [] }]);
      const url = `${API_BASE}/ratehawk/search?` +
        `destination=${selectedDestination}&` +
        `checkin=${checkin}&` +
        `checkout=${checkout}&` +
        `guests=${encodeURIComponent(guests)}`;

      const response = await fetch(url);
      const data = await response.json();

      const container = document.getElementById('hotels');
      container.innerHTML = data.hotels.map(hotel => `
        <div class="hotel-card">
          <h3>${hotel.name}</h3>
          <p>${hotel.address}</p>
          <p>⭐ ${hotel.star_rating}</p>
          <p>💰 $${hotel.price?.amount || 'N/A'}</p>
          <button onclick="viewHotel('${hotel.id}', '${checkin}', '${checkout}')">
            View Details
          </button>
        </div>
      `).join('');
    }

    // View hotel details
    async function viewHotel(hotelId, checkin, checkout) {
      const response = await fetch(`${API_BASE}/ratehawk/hotel/details`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hotelId,
          checkin,
          checkout,
          guests: [{ adults: 2, children: [] }]
        })
      });

      const data = await response.json();
      console.log('Hotel Details:', data);
      alert(`Hotel: ${data.data.hotel.name}\nRates: ${data.data.hotel.rates.length}`);
    }

    // Auto-login on page load
    if (!authToken) {
      login();
    }
  </script>
</body>
</html>
```

---

## React

### API Service (api.js)

```javascript
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class APIService {
  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token && !options.skipAuth) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Authentication
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });

    this.token = data.token;
    localStorage.setItem('auth_token', data.token);
    return data;
  }

  async register(email, password) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });

    this.token = data.token;
    localStorage.setItem('auth_token', data.token);
    return data;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  // Destinations
  async autocomplete(query) {
    return this.request(`/destinations/autocomplete?query=${query}`, {
      skipAuth: true,
    });
  }

  // Hotels
  async searchHotels(params) {
    const { destination, checkin, checkout, guests } = params;
    const guestsStr = encodeURIComponent(JSON.stringify(guests));
    return this.request(
      `/ratehawk/search?destination=${destination}&checkin=${checkin}&checkout=${checkout}&guests=${guestsStr}`,
      { skipAuth: true }
    );
  }

  async getHotelDetails(hotelId, checkin, checkout, guests) {
    return this.request('/ratehawk/hotel/details', {
      method: 'POST',
      body: JSON.stringify({ hotelId, checkin, checkout, guests }),
    });
  }
}

export default new APIService();
```

### React Hook (useHotelSearch.js)

```javascript
import { useState, useCallback } from 'react';
import api from './api';

export function useHotelSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hotels, setHotels] = useState([]);

  const searchHotels = useCallback(async (params) => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.searchHotels(params);
      setHotels(data.hotels);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { hotels, loading, error, searchHotels };
}
```

### Search Component (HotelSearch.jsx)

```javascript
import React, { useState } from 'react';
import { useHotelSearch } from './useHotelSearch';
import api from './api';

export default function HotelSearch() {
  const [query, setQuery] = useState('');
  const [destinations, setDestinations] = useState([]);
  const [selectedDest, setSelectedDest] = useState(null);
  const [dates, setDates] = useState({
    checkin: '',
    checkout: '',
  });

  const { hotels, loading, error, searchHotels } = useHotelSearch();

  // Autocomplete destinations
  const handleSearch = async (value) => {
    setQuery(value);
    if (value.length < 2) return;

    try {
      const data = await api.autocomplete(value);
      setDestinations(data.results);
    } catch (err) {
      console.error('Autocomplete failed:', err);
    }
  };

  // Search hotels
  const handleSearchHotels = async (e) => {
    e.preventDefault();

    if (!selectedDest || !dates.checkin || !dates.checkout) {
      alert('Please fill all fields');
      return;
    }

    try {
      await searchHotels({
        destination: selectedDest.id,
        checkin: dates.checkin,
        checkout: dates.checkout,
        guests: [{ adults: 2, children: [] }],
      });
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  return (
    <div className="hotel-search">
      <form onSubmit={handleSearchHotels}>
        {/* Destination Search */}
        <div>
          <input
            type="text"
            placeholder="Search destination..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {destinations.length > 0 && (
            <ul className="autocomplete-results">
              {destinations.map((dest) => (
                <li
                  key={dest.id}
                  onClick={() => {
                    setSelectedDest(dest);
                    setQuery(dest.display_name);
                    setDestinations([]);
                  }}
                >
                  {dest.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Dates */}
        <input
          type="date"
          value={dates.checkin}
          onChange={(e) => setDates({ ...dates, checkin: e.target.value })}
        />
        <input
          type="date"
          value={dates.checkout}
          onChange={(e) => setDates({ ...dates, checkout: e.target.value })}
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search Hotels'}
        </button>
      </form>

      {/* Results */}
      {error && <div className="error">{error}</div>}

      {hotels.length > 0 && (
        <div className="hotels-grid">
          {hotels.map((hotel) => (
            <div key={hotel.id} className="hotel-card">
              <img src={hotel.images?.[0]} alt={hotel.name} />
              <h3>{hotel.name}</h3>
              <p>⭐ {hotel.star_rating}</p>
              <p>💰 ${hotel.price?.amount}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Vue.js

### API Plugin (api.js)

```javascript
// plugins/api.js
export default {
  install(app, options) {
    const API_BASE = options.baseURL || 'http://localhost:3001/api';

    const api = {
      async request(endpoint, options = {}) {
        const headers = {
          'Content-Type': 'application/json',
          ...options.headers,
        };

        const token = localStorage.getItem('auth_token');
        if (token && !options.skipAuth) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Request failed');
        }

        return data;
      },

      auth: {
        async login(email, password) {
          const data = await api.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
            skipAuth: true,
          });
          localStorage.setItem('auth_token', data.token);
          return data;
        },

        logout() {
          localStorage.removeItem('auth_token');
        },
      },

      destinations: {
        async autocomplete(query) {
          return api.request(`/destinations/autocomplete?query=${query}`, {
            skipAuth: true,
          });
        },
      },

      hotels: {
        async search(params) {
          const { destination, checkin, checkout, guests } = params;
          const guestsStr = encodeURIComponent(JSON.stringify(guests));
          return api.request(
            `/ratehawk/search?destination=${destination}&checkin=${checkin}&checkout=${checkout}&guests=${guestsStr}`,
            { skipAuth: true }
          );
        },

        async getDetails(hotelId, checkin, checkout, guests) {
          return api.request('/ratehawk/hotel/details', {
            method: 'POST',
            body: JSON.stringify({ hotelId, checkin, checkout, guests }),
          });
        },
      },
    };

    app.config.globalProperties.$api = api;
    app.provide('api', api);
  },
};
```

### Vue Component (HotelSearch.vue)

```vue
<template>
  <div class="hotel-search">
    <form @submit.prevent="searchHotels">
      <!-- Destination -->
      <div class="input-group">
        <input
          v-model="query"
          @input="handleAutocomplete"
          placeholder="Search destination..."
        />
        <ul v-if="destinations.length" class="autocomplete">
          <li
            v-for="dest in destinations"
            :key="dest.id"
            @click="selectDestination(dest)"
          >
            {{ dest.display_name }}
          </li>
        </ul>
      </div>

      <!-- Dates -->
      <input v-model="dates.checkin" type="date" />
      <input v-model="dates.checkout" type="date" />

      <button type="submit" :disabled="loading">
        {{ loading ? 'Searching...' : 'Search Hotels' }}
      </button>
    </form>

    <!-- Error -->
    <div v-if="error" class="error">{{ error }}</div>

    <!-- Results -->
    <div v-if="hotels.length" class="hotels-grid">
      <div
        v-for="hotel in hotels"
        :key="hotel.id"
        class="hotel-card"
        @click="viewHotel(hotel)"
      >
        <img :src="hotel.images?.[0]" :alt="hotel.name" />
        <h3>{{ hotel.name }}</h3>
        <p>⭐ {{ hotel.star_rating }}</p>
        <p>💰 ${{ hotel.price?.amount }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue';

const api = inject('api');

const query = ref('');
const destinations = ref([]);
const selectedDest = ref(null);
const dates = ref({ checkin: '', checkout: '' });
const hotels = ref([]);
const loading = ref(false);
const error = ref(null);

let autocompleteTimeout;

const handleAutocomplete = () => {
  clearTimeout(autocompleteTimeout);

  if (query.value.length < 2) {
    destinations.value = [];
    return;
  }

  autocompleteTimeout = setTimeout(async () => {
    try {
      const data = await api.destinations.autocomplete(query.value);
      destinations.value = data.results;
    } catch (err) {
      console.error('Autocomplete failed:', err);
    }
  }, 300);
};

const selectDestination = (dest) => {
  selectedDest.value = dest;
  query.value = dest.display_name;
  destinations.value = [];
};

const searchHotels = async () => {
  if (!selectedDest.value || !dates.value.checkin || !dates.value.checkout) {
    alert('Please fill all fields');
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const data = await api.hotels.search({
      destination: selectedDest.value.id,
      checkin: dates.value.checkin,
      checkout: dates.value.checkout,
      guests: [{ adults: 2, children: [] }],
    });

    hotels.value = data.hotels;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const viewHotel = async (hotel) => {
  try {
    const data = await api.hotels.getDetails(
      hotel.id,
      dates.value.checkin,
      dates.value.checkout,
      [{ adults: 2, children: [] }]
    );
    console.log('Hotel details:', data);
  } catch (err) {
    console.error('Failed to get details:', err);
  }
};
</script>
```

---

## Next.js

### API Routes (app/api/hotels/route.js)

```javascript
import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const destination = searchParams.get('destination');
  const checkin = searchParams.get('checkin');
  const checkout = searchParams.get('checkout');

  try {
    const guests = JSON.stringify([{ adults: 2, children: [] }]);
    const url = `${API_BASE}/ratehawk/search?` +
      `destination=${destination}&` +
      `checkin=${checkin}&` +
      `checkout=${checkout}&` +
      `guests=${encodeURIComponent(guests)}`;

    const response = await fetch(url);
    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

### Server Component (app/hotels/page.jsx)

```javascript
import HotelSearchClient from './HotelSearchClient';

export default function HotelsPage() {
  return (
    <main>
      <h1>Hotel Search</h1>
      <HotelSearchClient />
    </main>
  );
}
```

### Client Component (app/hotels/HotelSearchClient.jsx)

```javascript
'use client';

import { useState } from 'react';

export default function HotelSearchClient() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchHotels = async (params) => {
    setLoading(true);

    try {
      const url = `/api/hotels?` +
        `destination=${params.destination}&` +
        `checkin=${params.checkin}&` +
        `checkout=${params.checkout}`;

      const response = await fetch(url);
      const data = await response.json();

      setHotels(data.hotels);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Search form here */}
      {hotels.map((hotel) => (
        <div key={hotel.id}>{hotel.name}</div>
      ))}
    </div>
  );
}
```

---

## Common Utilities

### Date Helpers

```javascript
// Format date for API
export const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

// Get tomorrow's date
export const getTomorrow = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDate(tomorrow);
};

// Get date N days from now
export const getDateAfterDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
};

// Validate date range
export const isValidDateRange = (checkin, checkout) => {
  const checkinDate = new Date(checkin);
  const checkoutDate = new Date(checkout);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return checkinDate >= today && checkoutDate > checkinDate;
};
```

### Guest Configuration

```javascript
// Build guest object
export const buildGuestConfig = (rooms) => {
  return rooms.map(room => ({
    adults: room.adults || 2,
    children: room.children || []
  }));
};

// Example usage
const guests = buildGuestConfig([
  { adults: 2, children: [] },
  { adults: 1, children: [8, 10] }
]);
```

### Error Handler

```javascript
export class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export const handleAPIError = (error) => {
  if (error instanceof APIError) {
    if (error.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    } else if (error.status === 404) {
      return 'Resource not found';
    }
  }

  return error.message || 'An error occurred';
};
```

### Local Storage Manager

```javascript
export const storage = {
  setToken(token) {
    localStorage.setItem('auth_token', token);
  },

  getToken() {
    return localStorage.getItem('auth_token');
  },

  removeToken() {
    localStorage.removeItem('auth_token');
  },

  saveSearch(searchParams) {
    localStorage.setItem('last_search', JSON.stringify(searchParams));
  },

  getLastSearch() {
    const data = localStorage.getItem('last_search');
    return data ? JSON.parse(data) : null;
  }
};
```

---

## Testing Examples

### Jest Test (api.test.js)

```javascript
import api from './api';

describe('API Service', () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  test('login sets token', async () => {
    fetch.mockResponseOnce(JSON.stringify({
      success: true,
      token: 'test_token',
      user: { email: 'test@test.com' }
    }));

    const result = await api.login('test@test.com', 'password');

    expect(result.token).toBe('test_token');
    expect(localStorage.getItem('auth_token')).toBe('test_token');
  });

  test('search hotels returns results', async () => {
    fetch.mockResponseOnce(JSON.stringify({
      success: true,
      hotels: [{ id: 'hotel_1', name: 'Test Hotel' }]
    }));

    const result = await api.searchHotels({
      destination: '1234',
      checkin: '2024-02-01',
      checkout: '2024-02-05',
      guests: [{ adults: 2, children: [] }]
    });

    expect(result.hotels).toHaveLength(1);
    expect(result.hotels[0].name).toBe('Test Hotel');
  });
});
```

---

**Last Updated:** January 2024
