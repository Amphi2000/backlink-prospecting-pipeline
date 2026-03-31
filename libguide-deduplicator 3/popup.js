let csvData = null;
let processedData = null;

// DOM Elements
const csvFileInput = document.getElementById('csvFile');
const fileNameDisplay = document.getElementById('fileName');
const processBtn = document.getElementById('processBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusDiv = document.getElementById('status');
const statsDiv = document.getElementById('stats');
const keywordsInput = document.getElementById('keywords');

// File upload handler
csvFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    fileNameDisplay.textContent = file.name;
    readCSV(file);
  }
});

// Read and parse CSV
function readCSV(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    csvData = parseCSV(text);
    processBtn.disabled = false;
    showStatus('CSV loaded successfully. Ready to process!', 'success');
  };
  reader.onerror = () => {
    showStatus('Error reading file. Please try again.', 'error');
  };
  reader.readAsText(file);
}

// Robust CSV parser that handles empty fields and quoted values
function parseCSV(text) {
  const lines = text.trim().split('\n');
  return lines.map(line => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field - push even if empty
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field - push even if empty
    result.push(current);
    
    return result;
  });
}

// Extract core domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url.trim());
    let hostname = urlObj.hostname;
    
    // Remove www.
    hostname = hostname.replace(/^www\./, '');
    
    // For .edu domains, keep the full educational domain
    // e.g., libguides.baylor.edu -> baylor.edu
    const parts = hostname.split('.');
    
    if (parts.length >= 2) {
      // Keep last two parts (domain.edu)
      return parts.slice(-2).join('.');
    }
    
    return hostname;
  } catch (e) {
    return null;
  }
}

// Score URL based on relevance
function scoreURL(url, keywords) {
  let score = 0;
  const urlLower = url.toLowerCase();
  const path = urlLower.split('?')[0]; // Ignore query params for keyword matching
  
  // 1. Keyword relevance (highest priority)
  keywords.forEach(keyword => {
    if (path.includes(keyword.toLowerCase())) {
      score += 100;
    }
  });
  
  // 2. Prefer static URLs over dynamic
  if (!urlLower.includes('?') || !urlLower.includes('c.php')) {
    score += 30;
  }
  
  // 3. Prefer HTTPS
  if (urlLower.startsWith('https://')) {
    score += 10;
  }
  
  // 4. Path depth (moderate depth is better)
  const pathDepth = (path.match(/\//g) || []).length;
  if (pathDepth >= 2 && pathDepth <= 4) {
    score += 20;
  }
  
  // 5. Penalize generic pages
  const genericTerms = ['/admin', '/search', '/profile', '/login', '/home', '/index'];
  genericTerms.forEach(term => {
    if (urlLower.includes(term)) {
      score -= 50;
    }
  });
  
  // 6. Prefer subject guides
  if (urlLower.includes('guide') || urlLower.includes('subject')) {
    score += 15;
  }
  
  return score;
}

// Process CSV and deduplicate
processBtn.addEventListener('click', () => {
  if (!csvData || csvData.length === 0) {
    showStatus('No data to process.', 'error');
    return;
  }
  
  const keywords = keywordsInput.value
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0);
  
  if (keywords.length === 0) {
    showStatus('Please enter at least one relevance keyword.', 'error');
    return;
  }
  
  showStatus('Processing...', 'info');
  processBtn.disabled = true;
  
  // Get header row
  const headers = csvData[0];
  
  // Process data
  const urlMap = new Map();
  let totalUrls = 0;
  
  csvData.forEach((row, index) => {
    if (index === 0) return; // Skip header
    if (row.length === 0 || !row[0]) return;
    
    const url = row[0].trim();
    if (!url) return;
    
    totalUrls++;
    const domain = extractDomain(url);
    
    if (!domain) return;
    
    const score = scoreURL(url, keywords);
    
    if (!urlMap.has(domain)) {
      urlMap.set(domain, { row, domain, score });
    } else {
      const existing = urlMap.get(domain);
      if (score > existing.score) {
        urlMap.set(domain, { row, domain, score });
      }
    }
  });
  
  // Convert to array with domain column added as second column
  processedData = {
    headers: [headers[0], 'Domain', ...headers.slice(1)],
    rows: Array.from(urlMap.values())
      .sort((a, b) => a.domain.localeCompare(b.domain))
      .map(item => [item.row[0], item.domain, ...item.row.slice(1)])
  };
  
  // Update stats
  const uniqueDomains = processedData.rows.length;
  const removed = totalUrls - uniqueDomains;
  
  document.getElementById('totalUrls').textContent = totalUrls;
  document.getElementById('uniqueDomains').textContent = uniqueDomains;
  document.getElementById('removed').textContent = removed;
  
  statsDiv.style.display = 'grid';
  downloadBtn.style.display = 'flex';
  processBtn.disabled = false;
  
  showStatus(`Success! Removed ${removed} duplicate URLs from ${totalUrls} total URLs.`, 'success');
});

// Download processed CSV
downloadBtn.addEventListener('click', () => {
  if (!processedData) return;
  
  // Create CSV content with headers
  let csvContent = processedData.headers.map(h => `"${h}"`).join(',') + '\n';
  
  // Add data rows
  processedData.rows.forEach(row => {
    const escapedRow = row.map(cell => {
      const cellStr = String(cell || '');
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (cellStr.includes('"') || cellStr.includes(',') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return `"${cellStr}"`;
    });
    csvContent += escapedRow.join(',') + '\n';
  });
  
  // Create download
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cleaned_libguides.csv';
  a.click();
  URL.revokeObjectURL(url);
  
  showStatus('CSV downloaded successfully!', 'success');
});

// Show status message
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
}
