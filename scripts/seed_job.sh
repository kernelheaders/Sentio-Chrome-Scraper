#!/usr/bin/env bash

set -euo pipefail

# Sentio mock job seeder
# Usage examples:
#   bash scripts/seed_job.sh -u "https://www.sahibinden.com/satilik-daire" -n 10
#   bash scripts/seed_job.sh --url "..." --count 20 --type detail_scrape
# Env overrides:
#   SENTIO_API_KEY (default dev key)
#   SENTIO_API_HOST (default 127.0.0.1:3001)

API_KEY="${SENTIO_API_KEY:-test_api_key_12345678901234567890123456}"
HOST="${SENTIO_API_HOST:-127.0.0.1:3001}"
TYPE="detail_scrape"
URL=""
COUNT=10
RESET_FIRST=false
REQUIRE_PHONE=true
ADDR_CLICK_CHANCE=0.15
SCROLL_CHANCE=0.85
NEW_TAB_CHANCE=0.0
QUICK_SKIP_CHANCE=0.12
READING_WPM=220
MIN_NAV_DELAY=1000
MAX_NAV_DELAY=3000
MIN_PAGE_DWELL=12000
MAX_PAGE_DWELL=25000
BREAK_AFTER_N=6
SHORT_BREAK_MIN=30000
SHORT_BREAK_MAX=90000
LONG_BREAK_AFTER=13
LONG_BREAK_MIN=180000
LONG_BREAK_MAX=420000

print_help() {
  cat <<EOF
Seed a job into the Sentio mock server

Options:
  -u, --url <url>         Listing URL (required)
  -n, --count <num>       Max items to scrape (default: 10)
  -t, --type <type>       Job type: detail_scrape | listing_scrape (default: detail_scrape)
  -r, --reset             Reset mock data before seeding (optional)
  -h, --host <host>       API host (default: ${HOST})
  --help                  Show this help

Env:
  SENTIO_API_KEY          API key (default dev key)
  SENTIO_API_HOST         API host (default ${HOST})

Examples:
  bash scripts/seed_job.sh -u "https://www.sahibinden.com/satilik-daire" -n 10
  bash scripts/seed_job.sh -u "https://www.sahibinden.com/emlak" -n 20 -t listing_scrape
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -u|--url)
        URL="$2"; shift 2;;
      -n|--count)
        COUNT="$2"; shift 2;;
      -t|--type)
        TYPE="$2"; shift 2;;
      -r|--reset)
        RESET_FIRST=true; shift 1;;
      --require-phone)
        REQUIRE_PHONE="$2"; shift 2;;
      --address-click-chance)
        ADDR_CLICK_CHANCE="$2"; shift 2;;
      --scroll-chance)
        SCROLL_CHANCE="$2"; shift 2;;
      --new-tab-chance)
        NEW_TAB_CHANCE="$2"; shift 2;;
      --quick-skip-chance)
        QUICK_SKIP_CHANCE="$2"; shift 2;;
      --reading-wpm)
        READING_WPM="$2"; shift 2;;
      --min-nav-delay)
        MIN_NAV_DELAY="$2"; shift 2;;
      --max-nav-delay)
        MAX_NAV_DELAY="$2"; shift 2;;
      --min-page-dwell)
        MIN_PAGE_DWELL="$2"; shift 2;;
      --max-page-dwell)
        MAX_PAGE_DWELL="$2"; shift 2;;
      --break-after-n)
        BREAK_AFTER_N="$2"; shift 2;;
      --short-break-min)
        SHORT_BREAK_MIN="$2"; shift 2;;
      --short-break-max)
        SHORT_BREAK_MAX="$2"; shift 2;;
      --long-break-after)
        LONG_BREAK_AFTER="$2"; shift 2;;
      --long-break-min)
        LONG_BREAK_MIN="$2"; shift 2;;
      --long-break-max)
        LONG_BREAK_MAX="$2"; shift 2;;
      -h|--host)
        HOST="$2"; shift 2;;
      --help)
        print_help; exit 0;;
      *)
        echo "Unknown option: $1" >&2; print_help; exit 1;;
    esac
  done

  if [[ -z "$URL" ]]; then
    echo "Error: --url is required" >&2
    print_help; exit 1
  fi
}

seed_job() {
  local url="$URL"
  local count="$COUNT"
  local type="$TYPE"
  local host="$HOST"
  local reqPhone="$REQUIRE_PHONE"
  local addrClick="$ADDR_CLICK_CHANCE"
  local scrollChance="$SCROLL_CHANCE"
  local newTabChance="$NEW_TAB_CHANCE"
  local quickSkip="$QUICK_SKIP_CHANCE"
  local readingWpm="$READING_WPM"
  local minNav="$MIN_NAV_DELAY"
  local maxNav="$MAX_NAV_DELAY"
  local minDwell="$MIN_PAGE_DWELL"
  local maxDwell="$MAX_PAGE_DWELL"
  local breakAfter="$BREAK_AFTER_N"
  local sbMin="$SHORT_BREAK_MIN"
  local sbMax="$SHORT_BREAK_MAX"
  local lbAfter="$LONG_BREAK_AFTER"
  local lbMin="$LONG_BREAK_MIN"
  local lbMax="$LONG_BREAK_MAX"

  if $RESET_FIRST; then
    echo "🔄 Resetting mock data on http://$host ..."
    curl -sS -X POST "http://$host/v1/reset" >/dev/null && echo "✅ Reset complete" || echo "⚠️ Reset failed (continuing)"
  fi

  echo "🚀 Seeding job ($type) → $url (maxItems=$count)"

  # Build JSON payload inline
  read -r -d '' BODY <<JSON || true
{
  "type": "${type}",
  "config": {
    "url": "${url}",
    "selectors": {
      "listing": ".searchResultsTaglineText a",
      "detailTitle": ".classifiedTitle",
      "detailPrice": ".priceContainer",
      "address": ".classifiedInfo , .address , .classifiedDetail",
      "phone": ".phone-number , [id*=phone]",
      "contactName": ".contact-name , .user-about , .username",
      "detailContainer": ".classifiedDetail"
    },
    "maxItems": ${count},
    "timeout": 60000,
    "humanize": {
      "warmup": true,
      "randomScroll": true,
      "randomScrollChance": ${scrollChance},
      "addressClickChance": ${addrClick},
      "newTabChance": ${newTabChance},
      "quickSkipChance": ${quickSkip},
      "readingSpeedWpm": ${readingWpm},
      "minNavDelay": ${minNav},
      "maxNavDelay": ${maxNav},
      "minPageDwell": ${minDwell},
      "maxPageDwell": ${maxDwell},
      "breakAfterN": ${breakAfter},
      "shortBreakMin": ${sbMin},
      "shortBreakMax": ${sbMax},
      "longBreakAfter": ${lbAfter},
      "longBreakMin": ${lbMin},
      "longBreakMax": ${lbMax}
    },
    "followDetails": true,
    "requirePhone": ${reqPhone}
  }
}
JSON

  # Submit job
  RESP=$(curl -sS -X POST \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$BODY" \
    "http://$host/v1/jobs")

  echo "🧾 Response: $RESP"
}

parse_args "$@"
seed_job
