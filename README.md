# Backlink Prospecting Pipeline

Four tools that automate the full backlink outreach workflow — 
from finding prospects to sending emails.

## The Pipeline

### 1. `backlink_collector` — Google Search Scraper
Scrapes Google search results and collects URLs into a dataset. Supports a queue 
system for running multiple searches hands-free with automatic pagination.

### 2. `libguide-deduplicator` — URL Deduplicator
Takes the raw URL list and deduplicates by root domain, keeping the highest-scoring 
URL per university. Uses keyword-based scoring to prioritize relevant pages.

### 3. `email-collector` — Contact Email Extractor
Visits each URL, extracts contact emails, scores them by relevance, and exports 
a sorted CSV ready for outreach.

### 4. `email-sender` — Automated Email Sequence
Google Apps Script that sends the outreach emails automatically. Handles intro 
emails and follow-ups with configurable delays, daily send limits, randomized 
timing to appear human, quota detection, and full logging to Google Sheets.

## How It Works Together
1. Run the search scraper to build a list of target URLs
2. Run the deduplicator to clean the list — one URL per domain
3. Run the email extractor to get the contact email for each site
4. Load the contacts into Google Sheets and let the email sender run automatically

## Tech
Built with JavaScript, Chrome Extension Manifest V3, Chrome APIs, and Google Apps Script.
