# @guardsync/utils

Shared utility functions for GuardSync applications.

## Installation

This package is part of the GuardSync monorepo and is installed as a workspace dependency.

## Usage

```typescript
import { cn, formatDate, calculateDistance, generateId } from '@guardsync/utils';

// Merge CSS classes
const className = cn('base-class', condition && 'conditional-class');

// Format dates
const formatted = formatDate(new Date(), { month: 'long', day: 'numeric' });

// Calculate distance between coordinates
const distance = calculateDistance(lat1, lon1, lat2, lon2);

// Generate unique IDs
const id = generateId('user');
```

## Available Utilities

### Class Name Utilities (`cn.ts`)
- `cn()` - Merge Tailwind CSS classes with clsx

### Date Utilities (`date.ts`)
- `formatDate()` - Format dates
- `formatTime()` - Format times
- `formatDateTime()` - Format date-times
- `getRelativeTime()` - Get relative time strings

### Format Utilities (`format.ts`)
- `formatCurrency()` - Format currency values
- `formatNumber()` - Format numbers
- `formatDistance()` - Format distances
- `truncate()` - Truncate strings
- `capitalize()` - Capitalize strings

### Geolocation Utilities (`geo.ts`)
- `calculateDistance()` - Calculate distance using Haversine formula
- `isPointInPolygon()` - Check if point is in polygon

### ID Generation (`id.ts`)
- `generateId()` - Generate random IDs with optional prefix
- `generateUUID()` - Generate UUID v4
- `generateShortId()` - Generate short random IDs
