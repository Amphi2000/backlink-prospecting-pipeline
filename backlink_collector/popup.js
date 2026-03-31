// popup.js - Controls the extension popup interface

document.addEventListener('DOMContentLoaded', function() {
  loadStats();
  loadSettings();
  loadQueue();
  
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      document.getElementById(tabName + '-tab').classList.add('active');
    });
  });
  
  // ===== ORIGINAL MANUAL TAB CODE (UNCHANGED) =====
  
  // Auto-collect toggle
  document.getElementById('autoCollectToggle').addEventListener('click', function() {
    this.classList.toggle('active');
    const enabled = this.classList.contains('active');
    chrome.storage.local.set({ collectionEnabled: enabled });
    updateStatus(enabled ? '✅ Auto-collect enabled' : '⏸️ Auto-collect paused');
  });
  
  // Auto next page toggle
  document.getElementById('autoNextToggle').addEventListener('click', function() {
    this.classList.toggle('active');
    const enabled = this.classList.contains('active');
    chrome.storage.local.set({ autoNext: enabled });
    updateStatus(enabled ? '✅ Auto next-page enabled' : '⏸️ Auto next-page disabled');
  });
  
  // Collect now button
  document.getElementById('collectNow').addEventListener('click', function() {
    console.log('🖱️ Collect Now button clicked');
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || tabs.length === 0) {
        updateStatus('❌ No active tab found');
        return;
      }
      
      const currentTab = tabs[0];
      console.log('🔍 Current tab URL:', currentTab.url);
      
      // Check if we're on a Google search page
      if (!currentTab.url || !currentTab.url.includes('google.com/search')) {
        updateStatus('⚠️ Please navigate to a Google search page first!');
        alert('Please go to Google and search for something first!\n\nThe extension only works on Google search result pages like:\nhttps://www.google.com/search?q=your+query');
        return;
      }
      
      chrome.tabs.sendMessage(currentTab.id, { action: 'collectNow' }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('❌ Error sending message:', chrome.runtime.lastError);
          updateStatus('❌ Error: Try refreshing the page');
          alert('Error communicating with page. Try:\n1. Refresh the Google search page\n2. Click the button again');
          return;
        }
        
        if (response && response.success) {
          updateStatus('✅ Collection triggered!');
          setTimeout(loadStats, 1000);
        } else {
          updateStatus('⚠️ Collection may have failed');
        }
      });
    });
  });
  
  // Export CSV button
  document.getElementById('exportCSV').addEventListener('click', exportToCSV);

  // Upload dedup list
  document.getElementById('uploadDedup').addEventListener('click', function() {
    document.getElementById('dedupFile').click();
  });

  document.getElementById('dedupFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
      const lines = event.target.result.split('\n');
      const domains = lines
        .map(l => l.replace(/"/g, '').trim())
        .filter(l => l.length > 3 && l.includes('.'))
        .map(l => {
          try { return new URL(l.startsWith('http') ? l : 'https://' + l).hostname.replace(/^www\./, ''); }
          catch(e) { return l.replace(/^www\./, ''); }
        });
      chrome.storage.local.get(['seenUrls'], function(result) {
        const existing = new Set(result.seenUrls || []);
        domains.forEach(d => existing.add(d));
        chrome.storage.local.set({ seenUrls: Array.from(existing) }, function() {
          updateStatus(`✅ Loaded ${domains.length} domains into dedup list`);
        });
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Download updated dedup list
  document.getElementById('downloadDedup').addEventListener('click', function() {
    chrome.storage.local.get(['seenUrls'], function(result) {
      const seenUrls = result.seenUrls || [];
      if (seenUrls.length === 0) {
        updateStatus('⚠️ Dedup list is empty');
        return;
      }
      const csvContent = seenUrls.map(u => `"${u}"`).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().split('T')[0];
      chrome.downloads.download({
        url: url,
        filename: `backlinks_master_dedup_${timestamp}.csv`,
        saveAs: true
      }, function() {
        updateStatus(`✅ Downloaded ${seenUrls.length} URLs`);
      });
    });
  });
  
  // Clear data button
  document.getElementById('clearData').addEventListener('click', function() {
    if (confirm('Are you sure? This will delete all collected backlinks.')) {
      chrome.storage.local.set({
        collectedResults: [],
        totalCollected: 0
      }, function() {
        loadStats();
        updateStatus('🗑️ All data cleared');
      });
    }
  });
  
  // ===== NEW QUEUE TAB CODE =====
  
  document.getElementById('addToQueue').addEventListener('click', addToQueue);
  document.getElementById('clearQueue').addEventListener('click', clearQueue);
  document.getElementById('startQueue').addEventListener('click', startQueue);
  document.getElementById('pauseQueue').addEventListener('click', pauseQueue);
});

// ===== ORIGINAL FUNCTIONS (UNCHANGED) =====

function loadStats() {
  chrome.storage.local.get(['totalCollected', 'lastCollected'], function(result) {
    document.getElementById('totalCount').textContent = result.totalCollected || 0;
    
    if (result.lastCollected) {
      const date = new Date(result.lastCollected);
      document.getElementById('lastUpdated').textContent = date.toLocaleTimeString();
    }
  });
}

function loadSettings() {
  chrome.storage.local.get(['collectionEnabled', 'autoNext'], function(result) {
    if (result.collectionEnabled) {
      document.getElementById('autoCollectToggle').classList.add('active');
    }
    
    if (result.autoNext) {
      document.getElementById('autoNextToggle').classList.add('active');
    }
  });
}

function updateStatus(message) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  
  if (message.includes('✅')) {
    statusEl.classList.add('active');
  } else {
    statusEl.classList.remove('active');
  }
}

function getRootDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    // Return last two parts only: e.g. ucla.edu, liberty.edu
    return parts.slice(-2).join('.');
  } catch(e) { return url; }
}

function exportToCSV() {
  chrome.storage.local.get(['collectedResults'], function(result) {
    const results = result.collectedResults || [];
    
    if (results.length === 0) {
      updateStatus('⚠️ No results to export');
      return;
    }

    // Deduplicate by root domain, keeping first occurrence
    const seenDomains = new Set();
    const deduped = results.filter(r => {
      const domain = getRootDomain(r.url);
      if (seenDomains.has(domain)) return false;
      seenDomains.add(domain);
      return true;
    });
    
    // Create CSV content
    const headers = ['URL', 'Title', 'Description', 'Query', 'Page', 'Timestamp'];
    const csvContent = [
      headers.join(','),
      ...deduped.map(r => [
        `"${(r.url || '').replace(/"/g, '""')}"`,
        `"${(r.title || '').replace(/"/g, '""')}"`,
        `"${(r.description || '').replace(/"/g, '""')}"`,
        `"${(r.query || '').replace(/"/g, '""')}"`,
        r.pageNumber || 1,
        r.timestamp || ''
      ].join(','))
    ].join('\n');
    
    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split('T')[0];
    
    chrome.downloads.download({
      url: url,
      filename: `backlinks_${timestamp}.csv`,
      saveAs: true
    }, function(downloadId) {
      updateStatus(`✅ Exported ${deduped.length} results!`);
    });
  });
}

// ===== NEW QUEUE FUNCTIONS =====

function loadQueue() {
  chrome.storage.local.get(['searchQueue', 'queueRunning', 'currentQueueIndex'], function(result) {
    const queue = result.searchQueue || [];
    const running = result.queueRunning || false;
    const currentIndex = result.currentQueueIndex || 0;
    
    const list = document.getElementById('queueList');
    
    if (queue.length === 0) {
      list.innerHTML = '<div style="text-align:center;opacity:0.7;padding:20px;">No queries yet</div>';
      document.getElementById('startQueue').disabled = true;
      return;
    }
    
    list.innerHTML = queue.map((item, idx) => {
      let className = 'queue-item';
      if (running && idx === currentIndex) className += ' active';
      if (item.completed) className += ' completed';
      
      return `
        <div class="${className}">
          <div class="queue-item-text">${idx + 1}. ${item.query}</div>
          <button class="queue-item-delete" data-index="${idx}">✕</button>
        </div>
      `;
    }).join('');
    
    document.querySelectorAll('.queue-item-delete').forEach(btn => {
      btn.addEventListener('click', function() {
        if (!running) deleteQueueItem(parseInt(this.dataset.index));
      });
    });
    
    document.getElementById('startQueue').disabled = false;
    
    if (running) {
      document.getElementById('startQueue').style.display = 'none';
      document.getElementById('pauseQueue').style.display = 'block';
    } else {
      document.getElementById('startQueue').style.display = 'block';
      document.getElementById('pauseQueue').style.display = 'none';
    }
  });
}

function addToQueue() {
  const input = document.getElementById('queryInput');
  const raw = input.value.trim();
  
  if (!raw) {
    updateStatus('⚠️ Enter a query first');
    return;
  }

  const queries = raw.split('\n').map(q => q.trim()).filter(q => q.length > 0);

  chrome.storage.local.get(['searchQueue'], function(result) {
    const queue = result.searchQueue || [];
    queries.forEach(q => queue.push({ query: q, completed: false }));
    
    chrome.storage.local.set({ searchQueue: queue }, function() {
      input.value = '';
      loadQueue();
      updateStatus(`✅ Added ${queries.length} quer${queries.length === 1 ? 'y' : 'ies'}`);
    });
  });
}

function deleteQueueItem(index) {
  chrome.storage.local.get(['searchQueue'], function(result) {
    const queue = result.searchQueue || [];
    queue.splice(index, 1);
    chrome.storage.local.set({ searchQueue: queue }, loadQueue);
  });
}

function clearQueue() {
  chrome.storage.local.get(['queueRunning'], function(result) {
    if (result.queueRunning) {
      updateStatus('⚠️ Pause first');
      return;
    }
    if (confirm('Clear all queries?')) {
      chrome.storage.local.set({ searchQueue: [], currentQueueIndex: 0 }, loadQueue);
    }
  });
}

function startQueue() {
  chrome.storage.local.set({ queueRunning: true, currentQueueIndex: 0 }, function() {
    chrome.runtime.sendMessage({ action: 'startQueue' });
    loadQueue();
    updateStatus('🚀 Queue started');
  });
}

function pauseQueue() {
  chrome.storage.local.set({ queueRunning: false }, function() {
    chrome.runtime.sendMessage({ action: 'pauseQueue' });
    loadQueue();
    updateStatus('⏸️ Queue paused');
  });
}

// Listen for queue updates
chrome.runtime.onMessage.addListener(function(request) {
  if (request.action === 'queueUpdate') {
    loadQueue();
    loadStats();
  }
  if (request.action === 'queueComplete') {
    updateStatus('🎉 Queue complete!');
    loadQueue();
    loadStats();
  }
});
