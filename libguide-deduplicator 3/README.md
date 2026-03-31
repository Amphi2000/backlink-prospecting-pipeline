# LibGuide Deduplicator - Chrome Extension

A clean, modern Chrome extension for deduplicating LibGuide URLs by domain, keeping the most relevant pages for backlink outreach.

## Features

- 📊 **Smart Deduplication**: Keeps only the most relevant LibGuide URL per domain
- 🎯 **Keyword Prioritization**: Prioritizes URLs containing Christianity/theology keywords
- 📈 **Visual Stats**: See total URLs, unique domains, and duplicates removed
- 💎 **Clean UI**: Modern, gradient design with smooth animations
- ⚡ **Fast Processing**: Client-side CSV processing with no server needed

## Installation

### Option 1: Load Unpacked Extension (Recommended for Development)

1. Download all extension files to a folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the folder containing the extension files
6. The extension icon will appear in your toolbar

### Option 2: Pack and Install

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Pack extension"
4. Select the extension folder
5. Install the generated `.crx` file

## How to Use

1. **Click the extension icon** in your Chrome toolbar
2. **Upload your CSV** file containing LibGuide URLs
3. **Customize keywords** (optional) - default includes: christianity, theology, religion, bible, faith, ministry, spirituality, church
4. **Click "Process CSV"** to deduplicate
5. **View stats** showing total URLs, unique domains, and duplicates removed
6. **Click "Download Cleaned CSV"** to get your deduplicated list

## How It Works

### Prioritization Algorithm

The extension scores each URL and keeps the highest-scoring URL per domain:

1. **Keyword Relevance (+100 points)**: URLs with Christianity/theology keywords in the path
2. **Static URLs (+30 points)**: Prefers clean URLs over dynamic query parameters
3. **Path Depth (+20 points)**: Favors moderate depth (2-4 levels)
4. **Subject Guides (+15 points)**: Prefers URLs containing "guide" or "subject"
5. **HTTPS (+10 points)**: Secure connections preferred
6. **Generic Pages (-50 points)**: Penalizes admin, search, login, profile pages

### Domain Extraction

- Extracts core `.edu` domain (e.g., `libguides.baylor.edu` → `baylor.edu`)
- Removes `www.` subdomain
- Handles various LibGuide URL formats

## CSV Format

### Input CSV
Your CSV can have any columns, but must have URL as the first column:
```csv
URL,Title,Description,Query,Page,Timestamp
https://libguides.baylor.edu/christiantheology,Biblical Studies: Home,...,site:.edu...,1,2026-02-12
https://guides.lib.berkeley.edu/religion,Religion Guide,...,site:.edu...,1,2026-02-12
https://libguides.baylor.edu/admin,Admin Page,...,site:.edu...,1,2026-02-12
```

Or even simpler:
```csv
URL,Title,Page
https://libguides.baylor.edu/christiantheology,Biblical Studies: Home,1
```

### Output CSV
Domain is inserted as the **second column**, all other columns preserved:
```csv
URL,Domain,Title,Description,Query,Page,Timestamp
https://libguides.baylor.edu/christiantheology,baylor.edu,Biblical Studies: Home,...,site:.edu...,1,2026-02-12
https://guides.lib.berkeley.edu/religion,berkeley.edu,Religion Guide,...,site:.edu...,1,2026-02-12
```

Note: The Baylor admin page was removed because the christiantheology page scored higher.

## Customization

You can customize the relevance keywords in the extension UI. Keywords are case-insensitive and separated by commas.

**Example keywords for Christian sites:**
- christianity, theology, religion, bible, faith, ministry, spirituality, church, pastoral, divinity, gospel

## Files Included

- `manifest.json` - Extension configuration
- `popup.html` - Extension UI structure
- `popup.js` - Processing logic
- `styles.css` - Modern styling
- `icon16.png`, `icon48.png`, `icon128.png` - Extension icons
- `README.md` - This file

## Technical Details

- **Manifest Version**: 3
- **Permissions**: None required (fully client-side)
- **Browser Support**: Chrome, Edge, Brave (Chromium-based browsers)
- **File Processing**: All processing happens in the browser - no data sent to servers

## Support

For issues or feature requests, modify the code as needed. The extension is fully open-source and customizable.

## License

Free to use and modify for personal or commercial purposes.
