# Timing Profiles for Human-Like Behavior

Mathematical values for different scraping profiles to balance speed vs. detection risk.

## Profile Comparison Table

| Behavior | Fast Profile | Normal Profile (Current) | Slow (Secure) Profile |
|----------|-------------|-------------------------|----------------------|
| **List Page Reading** | 0.5-2s | 1-5s | 3-8s |
| **Detail Page Reading** | 1.5-4s | 3-10s | 8-15s |
| **Click Delays** | 0.8-2s | 1.5-4s | 3-6s |
| **Strategic Breaks** | Every 25 ads | Every 15 ads | Every 10 ads |
| **Break Duration** | 10-30s | 20-70s | 60-120s |
| **Mouse Bursts** | 2-4 | 3-7 | 5-10 |
| **Scroll Amount** | 80-400px | 100-600px | 150-800px |

## Detailed Profile Configurations

### 🚀 Fast Profile
```javascript
const FAST_CONFIG = {
  PER_PAGE: 20,
  
  // Reading times - minimal but still human
  LIST_PAGE_READ_MIN: 500,     // 0.5-2 seconds
  LIST_PAGE_READ_MAX: 2000,
  DETAIL_PAGE_READ_MIN: 1500,  // 1.5-4 seconds  
  DETAIL_PAGE_READ_MAX: 4000,
  
  // Quick clicks - still realistic
  CLICK_DELAY_MIN: 800,        // 0.8-2 seconds
  CLICK_DELAY_MAX: 2000,
  
  // Fewer breaks - faster completion
  BREAK_AFTER_ADS: 25,         // Every 25 ads
  BREAK_MIN: 10000,            // 10-30 seconds
  BREAK_MAX: 30000,
  
  // Moderate mouse activity
  MOUSE_BURSTS_MIN: 2,
  MOUSE_BURSTS_MAX: 4,
  SCROLL_AMOUNT_MIN: 80,
  SCROLL_AMOUNT_MAX: 400
};

// Estimated completion time: ~2-4 minutes per page (20 ads)
// Risk level: Medium - faster but still human-like
```

### ⚖️ Normal Profile (Current Optimal)
```javascript
const NORMAL_CONFIG = {
  PER_PAGE: 20,
  
  // Balanced reading times
  LIST_PAGE_READ_MIN: 1000,    // 1-5 seconds
  LIST_PAGE_READ_MAX: 5000,
  DETAIL_PAGE_READ_MIN: 3000,  // 3-10 seconds  
  DETAIL_PAGE_READ_MAX: 10000,
  
  // Comfortable click delays
  CLICK_DELAY_MIN: 1500,       // 1.5-4 seconds
  CLICK_DELAY_MAX: 4000,
  
  // Regular breaks
  BREAK_AFTER_ADS: 15,         // Every 15 ads
  BREAK_MIN: 20000,            // 20-70 seconds
  BREAK_MAX: 70000,
  
  // Good mouse activity
  MOUSE_BURSTS_MIN: 3,
  MOUSE_BURSTS_MAX: 7,
  SCROLL_AMOUNT_MIN: 100,
  SCROLL_AMOUNT_MAX: 600
};

// Estimated completion time: ~5-8 minutes per page (20 ads)  
// Risk level: Low - well-balanced, recommended for production
```

### 🛡️ Slow (Secure) Profile
```javascript
const SECURE_CONFIG = {
  PER_PAGE: 20,
  
  // Extensive reading times
  LIST_PAGE_READ_MIN: 3000,    // 3-8 seconds
  LIST_PAGE_READ_MAX: 8000,
  DETAIL_PAGE_READ_MIN: 8000,  // 8-15 seconds  
  DETAIL_PAGE_READ_MAX: 15000,
  
  // Long delays between actions
  CLICK_DELAY_MIN: 3000,       // 3-6 seconds
  CLICK_DELAY_MAX: 6000,
  
  // Frequent breaks
  BREAK_AFTER_ADS: 10,         // Every 10 ads
  BREAK_MIN: 60000,            // 60-120 seconds (1-2 minutes)
  BREAK_MAX: 120000,
  
  // Extensive mouse activity
  MOUSE_BURSTS_MIN: 5,
  MOUSE_BURSTS_MAX: 10,
  SCROLL_AMOUNT_MIN: 150,
  SCROLL_AMOUNT_MAX: 800
};

// Estimated completion time: ~12-20 minutes per page (20 ads)
// Risk level: Very Low - maximum stealth, use for sensitive targets
```

## Profile Selection Logic

```javascript
// Profile selector function for future implementation
function getTimingProfile(profileType = 'normal') {
  switch (profileType.toLowerCase()) {
    case 'fast':
      return FAST_CONFIG;
    case 'secure':
    case 'slow': 
      return SECURE_CONFIG;
    case 'normal':
    default:
      return NORMAL_CONFIG;
  }
}
```

## Performance vs. Stealth Trade-offs

| Profile | Speed | Stealth | Use Case |
|---------|-------|---------|----------|
| **Fast** | ⚡⚡⚡ | 🛡️🛡️ | Development, testing, low-risk targets |
| **Normal** | ⚡⚡ | 🛡️🛡️🛡️ | Production default, balanced performance |
| **Secure** | ⚡ | 🛡️🛡️🛡️🛡️🛡️ | High-risk targets, maximum stealth needed |

## Implementation Notes

### Break Strategy
- **Fast**: Fewer breaks, shorter duration
- **Normal**: Balanced breaks that mimic natural user fatigue
- **Secure**: Frequent breaks that simulate very careful human browsing

### Mouse Behavior Intensity  
- **Fast**: Minimal but realistic mouse activity
- **Normal**: Moderate mouse activity with variety
- **Secure**: Extensive mouse activity, maximum human simulation

### Reading Time Philosophy
- **Fast**: Quick but not suspiciously fast
- **Normal**: Natural human reading speeds
- **Secure**: Slow, careful reader who examines everything

## Future Profile API

```javascript
// Future implementation structure
const profileConfig = {
  profile: 'normal',  // 'fast' | 'normal' | 'secure'
  customizations: {
    // Allow custom overrides
    breakAfterAds: 15,
    extraDelay: 0.5  // Multiplier for all delays
  }
};
```

---

**Current Implementation**: Normal Profile (optimal balance)
**Next Steps**: Implement profile selector in service worker job configuration