// Popup UI logic
let urlsToProcess = [];
let collectedData = [];
let isProcessing = false;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved data
  await loadSavedData();
  updateUI();
  
  // Check if batch processing is ongoing
  const processingState = await chrome.storage.local.get(['isProcessing', 'isPaused', 'currentIndex', 'totalUrls']);
  if (processingState.isProcessing) {
    document.getElementById('progressContainer').style.display = 'block';
    document.getElementById('stats').style.display = 'block';
    document.getElementById('collectBatch').disabled = true;
    document.getElementById('pauseBatch').style.display = 'block';
    
    if (processingState.isPaused) {
      const pauseBtn = document.getElementById('pauseBatch');
      pauseBtn.textContent = '▶️ Resume Processing';
      pauseBtn.classList.remove('danger-btn');
      pauseBtn.classList.add('secondary-btn');
      pauseBtn.onclick = resumeBatchProcessing;
      showStatus('Batch processing paused', 'info');
    } else {
      showStatus('Batch processing in progress...', 'info');
    }
    
    setupProgressListener();
  }
  
  // Set up event listeners
  document.getElementById('csvFile').addEventListener('change', handleFileUpload);
  document.getElementById('collectCurrent').addEventListener('click', collectFromCurrentPage);
  document.getElementById('collectBatch').addEventListener('click', collectFromBatch);
  document.getElementById('pauseBatch').addEventListener('click', pauseBatchProcessing);
  document.getElementById('exportCSV').addEventListener('click', exportToCSV);
  document.getElementById('clearData').addEventListener('click', clearAllData);
});

// Load saved data from storage
async function loadSavedData() {
  const result = await chrome.storage.local.get(['collectedEmails', 'urlList']);
  
  if (result.collectedEmails) {
    collectedData = result.collectedEmails;
  }
  
  if (result.urlList) {
    urlsToProcess = result.urlList;
    displayUrlPreview();
  }
}

// Save data to storage
async function saveData() {
  await chrome.storage.local.set({
    collectedEmails: collectedData,
    urlList: urlsToProcess
  });
}

// Handle CSV file upload
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const lines = text.split(/\r?\n|\r/);
    
    urlsToProcess = [];
    let skippedHeader = false;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;
      
      // Extract first column (URL)
      let url = '';
      
      if (line.startsWith('"')) {
        // Quoted field: "URL","other","stuff"
        const match = line.match(/^"([^"]+)"/);
        if (match) {
          url = match[1].trim();
        }
      } else {
        // Unquoted field: URL,other,stuff
        url = line.split(',')[0].trim();
      }
      
      // Check if this is a valid URL
      if (url.startsWith('http://') || url.startsWith('https://')) {
        urlsToProcess.push(url);
      } else if (!skippedHeader && url.toLowerCase() === 'url') {
        // This is the header row, skip it
        skippedHeader = true;
        continue;
      }
    }
    
    if (urlsToProcess.length === 0) {
      showStatus('❌ No URLs found in CSV file', 'error');
      return;
    }
    
    await saveData();
    displayUrlPreview();
    document.getElementById('collectBatch').disabled = false;
    showStatus(`✅ Loaded ${urlsToProcess.length} URLs ready to process!`, 'success');
    
  } catch (error) {
    showStatus('Error reading CSV: ' + error.message, 'error');
  }
}

// Display preview of loaded URLs
function displayUrlPreview() {
  const preview = document.getElementById('urlPreview');
  const fileLabel = document.getElementById('fileLabel');
  
  if (urlsToProcess.length > 0) {
    preview.style.display = 'block';
    preview.innerHTML = urlsToProcess.slice(0, 10).map(url => 
      `<div class="url-item">${url}</div>`
    ).join('');
    
    if (urlsToProcess.length > 10) {
      preview.innerHTML += `<div class="url-item"><em>...and ${urlsToProcess.length - 10} more</em></div>`;
    }
    
    fileLabel.textContent = `✅ ${urlsToProcess.length} URLs Loaded`;
    fileLabel.classList.add('loaded');
  }
}

// Collect emails from current page
async function collectFromCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    showStatus('No active tab found', 'error');
    return;
  }
  
  showStatus('Extracting emails from current page...', 'info');
  document.getElementById('collectCurrent').disabled = true;
  
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractEmails' });
    
    if (response && response.emails) {
      // Add emails one by one with animation
      for (const emailData of response.emails) {
        const exists = collectedData.find(e => e.email === emailData.email);
        if (!exists) {
          collectedData.push(emailData);
          await saveData();
          displayEmails();
          await sleep(100); // Small delay for visual effect
        }
      }
      
      updateUI();
      
      const librarianCount = response.emails.filter(e => e.score >= 60).length;
      let statusMsg = `Found ${response.emails.length} emails (${librarianCount} high-priority)`;
      
      // Mention if contact pages were found
      if (response.contactPages && response.contactPages.length > 0) {
        statusMsg += ` • ${response.contactPages.length} contact page(s) detected`;
      }
      
      showStatus(statusMsg, 'success');
    } else {
      showStatus('No emails found on this page', 'info');
    }
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
  } finally {
    document.getElementById('collectCurrent').disabled = false;
  }
}

// Collect emails from batch of URLs
async function collectFromBatch() {
  if (urlsToProcess.length === 0) {
    showStatus('No URLs to process', 'error');
    return;
  }
  
  isProcessing = true;
  document.getElementById('collectBatch').disabled = true;
  document.getElementById('collectCurrent').disabled = true;
  document.getElementById('pauseBatch').style.display = 'block';
  document.getElementById('progressContainer').style.display = 'block';
  document.getElementById('stats').style.display = 'block';
  
  // Save processing state
  await chrome.storage.local.set({ 
    isProcessing: true,
    isPaused: false,
    currentIndex: 0,
    totalUrls: urlsToProcess.length
  });
  
  // Start background processing
  chrome.runtime.sendMessage({ 
    action: 'startBatchProcessing',
    urls: urlsToProcess 
  });
  
  showStatus('Batch processing started in background. You can close this popup.', 'success');
  
  // Set up listener for progress updates
  setupProgressListener();
}

// Pause batch processing
async function pauseBatchProcessing() {
  const pauseBtn = document.getElementById('pauseBatch');
  
  await chrome.storage.local.set({ isPaused: true });
  chrome.runtime.sendMessage({ action: 'pauseProcessing' });
  
  pauseBtn.textContent = '▶️ Resume Processing';
  pauseBtn.classList.remove('danger-btn');
  pauseBtn.classList.add('secondary-btn');
  pauseBtn.onclick = resumeBatchProcessing;
  
  showStatus('Processing paused', 'info');
}

// Resume batch processing
async function resumeBatchProcessing() {
  const pauseBtn = document.getElementById('pauseBatch');
  
  await chrome.storage.local.set({ isPaused: false });
  chrome.runtime.sendMessage({ action: 'resumeProcessing' });
  
  pauseBtn.textContent = '⏸️ Pause Processing';
  pauseBtn.classList.remove('secondary-btn');
  pauseBtn.classList.add('danger-btn');
  pauseBtn.onclick = pauseBatchProcessing;
  
  showStatus('Processing resumed', 'success');
}

// Set up listener for background progress updates
let progressListenerSetup = false;
function setupProgressListener() {
  if (progressListenerSetup) return; // Prevent duplicate listeners
  
  progressListenerSetup = true;
  
  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'progressUpdate') {
      updateProgress(request.processed, request.total);
      
      if (request.emails && request.emails.length > 0) {
        // Reload data from storage to get latest
        await loadSavedData();
        displayEmails();
      }
      
      if (request.status) {
        showStatus(request.status, request.statusType || 'info');
      }
    }
    
    if (request.action === 'batchComplete') {
      isProcessing = false;
      document.getElementById('collectBatch').disabled = false;
      document.getElementById('collectCurrent').disabled = false;
      document.getElementById('pauseBatch').style.display = 'none';
      await chrome.storage.local.set({ isProcessing: false, isPaused: false });
      showStatus(`✅ Completed! Processed ${request.total} pages`, 'success');
      await loadSavedData();
      updateUI();
    }
  });
}

// Update progress bar and stats
function updateProgress(current, total) {
  const percentage = Math.round((current / total) * 100);
  const progressBar = document.getElementById('progressBar');
  progressBar.style.width = percentage + '%';
  progressBar.textContent = `${current}/${total} (${percentage}%)`;
  
  // Show actual pages processed (not just ones with emails)
  document.getElementById('pagesProcessed').textContent = current;
  
  // Only count valid emails (not empty ones)
  const validEmails = collectedData.filter(e => e.email && e.score > 0);
  document.getElementById('emailsFound').textContent = validEmails.length;
  
  const librarianEmails = validEmails.filter(e => e.score >= 60).length;
  document.getElementById('librarianEmails').textContent = librarianEmails;
}

// Update UI with current stats
function updateUI() {
  const stats = document.getElementById('stats');
  // Filter out empty emails (score 0 or no email)
  const validEmails = collectedData.filter(e => e.email && e.score > 0);
  
  if (validEmails.length > 0 || collectedData.length > 0) {
    stats.style.display = 'block';
    
    // Show total unique URLs processed (including ones with no emails)
    document.getElementById('pagesProcessed').textContent = 
      new Set(collectedData.map(e => e.sourceUrl || e.url)).size;
    
    // Show only valid emails found
    document.getElementById('emailsFound').textContent = validEmails.length;
    
    const librarianEmails = validEmails.filter(e => e.score >= 60).length;
    document.getElementById('librarianEmails').textContent = librarianEmails;
    
    document.getElementById('exportCSV').disabled = false;
    
    // Show emails section and display them
    displayEmails();
  } else {
    document.getElementById('exportCSV').disabled = true;
    document.getElementById('emailsSection').style.display = 'none';
  }
}

// Display collected emails in real-time
function displayEmails() {
  const emailsSection = document.getElementById('emailsSection');
  const emailsList = document.getElementById('emailsList');
  
  // Filter out empty emails
  const validEmails = collectedData.filter(e => e.email && e.score > 0);
  
  if (validEmails.length === 0) {
    emailsSection.style.display = 'none';
    return;
  }
  
  emailsSection.style.display = 'block';
  
  // Sort by score (highest first)
  const sorted = [...validEmails].sort((a, b) => b.score - a.score);
  
  // Create HTML for each email
  emailsList.innerHTML = sorted.map((item, index) => {
    const scoreClass = item.score >= 60 ? 'score-high' : 
                       item.score >= 40 ? 'score-medium' : 'score-low';
    const priority = item.score >= 60 ? '🟢 High Priority' : 
                     item.score >= 40 ? '🟡 Medium' : '🔴 Low';
    
    const name = item.name ? `<span class="email-name">👤 ${item.name}</span>` : '';
    const urlDisplay = item.url ? new URL(item.url).hostname : '';
    
    const isNew = index === 0 && sorted.length === collectedData.length;
    
    return `
      <div class="email-item ${isNew ? 'new' : ''}">
        <div class="email-address">${item.email}</div>
        <div class="email-meta">
          <span class="email-score ${scoreClass}">${item.score} pts • ${priority}</span>
          ${name}
        </div>
        <div class="email-meta">
          <span class="email-source">📍 ${item.source}</span>
          <span class="email-url" title="${item.url}">${urlDisplay}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Add a new email and update display immediately
function addEmailToDisplay(emailData) {
  // Add to collected data if not exists
  const exists = collectedData.find(e => e.email === emailData.email);
  if (!exists) {
    collectedData.push(emailData);
    saveData();
    updateUI();
    
    // Flash the new email
    setTimeout(() => {
      const emailItems = document.querySelectorAll('.email-item');
      if (emailItems.length > 0) {
        emailItems[0].classList.remove('new');
      }
    }, 500);
  }
}

// Export collected data to CSV
async function exportToCSV() {
  if (collectedData.length === 0) {
    showStatus('No data to export', 'error');
    return;
  }
  
  // Sort by score (highest first)
  const sorted = [...collectedData].sort((a, b) => b.score - a.score);
  
  // Create CSV content with Source URL first
  let csv = 'Source URL,Email,Name,Score,Priority,Source Type,Context,Found On URL\n';
  
  for (const item of sorted) {
    const priority = item.score >= 60 ? 'High (Librarian)' : 
                    item.score >= 40 ? 'Medium' : 'Low';
    const context = (item.context || '').replace(/"/g, '""').replace(/\n/g, ' ');
    const name = (item.name || '').replace(/"/g, '""');
    const sourceUrl = item.sourceUrl || item.url; // Use sourceUrl if available, fallback to url
    const foundOnUrl = item.url;
    
    csv += `"${sourceUrl}","${item.email}","${name}",${item.score},"${priority}","${item.source}","${context}","${foundOnUrl}"\n`;
  }
  
  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `librarian-emails-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  showStatus(`Exported ${sorted.length} emails to CSV`, 'success');
}

// Clear all collected data
async function clearAllData() {
  if (!confirm('Are you sure you want to clear all collected data? This cannot be undone.')) {
    return;
  }
  
  collectedData = [];
  urlsToProcess = [];
  isProcessing = false;
  
  await chrome.storage.local.clear();
  
  const fileLabel = document.getElementById('fileLabel');
  const preview = document.getElementById('urlPreview');
  
  preview.style.display = 'none';
  fileLabel.textContent = '📤 Click to upload CSV file';
  fileLabel.classList.remove('loaded');
  
  document.getElementById('collectBatch').disabled = true;
  document.getElementById('progressContainer').style.display = 'none';
  document.getElementById('stats').style.display = 'none';
  document.getElementById('emailsSection').style.display = 'none';
  
  updateUI();
  showStatus('All data cleared', 'success');
}

// Show status message
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status-${type}`;
  status.style.display = 'block';
  
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      status.style.display = 'none';
    }, 5000);
  }
}

// Helper sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
