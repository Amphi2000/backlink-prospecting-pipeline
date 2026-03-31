// background.js - Background service worker

// ===== ORIGINAL CODE (UNCHANGED) =====

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'updateBadge') {
    // Update extension badge with count
    chrome.action.setBadgeText({
      text: request.count > 999 ? '999+' : request.count.toString()
    });
    
    chrome.action.setBadgeBackgroundColor({
      color: '#4CAF50'
    });
  }
  
  // NEW: Queue control messages
  if (request.action === 'startQueue') {
    processQueue();
  }
  
  if (request.action === 'pauseQueue') {
    stopQueueProcessing();
  }
});

// Initialize badge on install
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.set({
    collectionEnabled: false,
    autoNext: false,
    collectedResults: [],
    totalCollected: 0,
    searchQueue: [],
    queueRunning: false,
    currentQueueIndex: 0
  });
  
  chrome.action.setBadgeText({ text: '0' });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
});

// Update badge when storage changes
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (changes.totalCollected) {
    const count = changes.totalCollected.newValue || 0;
    chrome.action.setBadgeText({
      text: count > 999 ? '999+' : count.toString()
    });
  }
});

// ===== NEW QUEUE PROCESSOR =====

let queueCheckInterval = null;

async function processQueue() {
  const data = await chrome.storage.local.get(['searchQueue', 'currentQueueIndex', 'queueRunning']);
  
  if (!data.queueRunning) return;
  
  const queue = data.searchQueue || [];
  const index = data.currentQueueIndex || 0;
  
  if (index >= queue.length) {
    // Queue complete
    await chrome.storage.local.set({ queueRunning: false, currentQueueIndex: 0 });
    chrome.runtime.sendMessage({ action: 'queueComplete' });
    stopQueueProcessing();
    return;
  }
  
  const query = queue[index];
  console.log(`Processing query ${index + 1}/${queue.length}: ${query.query}`);
  
  // Find or create Google tab
  const tabs = await chrome.tabs.query({});
  let tab = tabs.find(t => t.url && t.url.includes('google.com/search'));
  
  if (!tab) {
    tab = await chrome.tabs.create({ 
      url: `https://www.google.com/search?q=${encodeURIComponent(query.query)}`,
      active: false
    });
  } else {
    await chrome.tabs.update(tab.id, { 
      url: `https://www.google.com/search?q=${encodeURIComponent(query.query)}`
    });
  }
  
  // Enable auto-collection
  await chrome.storage.local.set({ 
    collectionEnabled: true,
    autoNext: true
  });
  
  // Wait for collection to finish (when autoNext is disabled, it means we hit the end)
  startMonitoringCollection(index);
}

function startMonitoringCollection(currentIndex) {
  if (queueCheckInterval) clearInterval(queueCheckInterval);
  
  queueCheckInterval = setInterval(async () => {
    const data = await chrome.storage.local.get(['autoNext', 'queueRunning', 'searchQueue']);
    
    // If autoNext is off, it means collection finished (hit end of results)
    if (!data.autoNext) {
      clearInterval(queueCheckInterval);
      
      // Mark this query as completed
      const queue = data.searchQueue || [];
      if (queue[currentIndex]) {
        queue[currentIndex].completed = true;
        await chrome.storage.local.set({ searchQueue: queue });
      }
      
      // Move to next query
      const nextIndex = currentIndex + 1;
      await chrome.storage.local.set({ currentQueueIndex: nextIndex });
      
      chrome.runtime.sendMessage({ action: 'queueUpdate' });
      
      // Wait 3 seconds then process next
      if (data.queueRunning) {
        setTimeout(() => processQueue(), 3000);
      }
    }
  }, 3000); // Check every 3 seconds
}

function stopQueueProcessing() {
  if (queueCheckInterval) {
    clearInterval(queueCheckInterval);
    queueCheckInterval = null;
  }
  chrome.storage.local.set({ 
    collectionEnabled: false,
    autoNext: false
  });
}
