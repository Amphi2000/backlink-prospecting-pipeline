// Background service worker for the extension
// This handles batch processing that continues even when popup is closed

let processingState = {
  isProcessing: false,
  isPaused: false,
  urls: [],
  currentIndex: 0,
  collectedEmails: []
};

chrome.runtime.onInstalled.addListener(() => {
  console.log('Smart Librarian Email Collector installed');
  // Restore processing state if it exists
  chrome.storage.local.get(['isProcessing', 'isPaused', 'urlList', 'currentIndex', 'collectedEmails'], (result) => {
    if (result.isProcessing) {
      processingState = {
        isProcessing: true,
        isPaused: result.isPaused || false,
        urls: result.urlList || [],
        currentIndex: result.currentIndex || 0,
        collectedEmails: result.collectedEmails || []
      };
      // Resume processing if not paused
      if (!processingState.isPaused && processingState.urls.length > processingState.currentIndex) {
        console.log('Resuming interrupted batch processing');
        continueBatchProcessing();
      }
    }
  });
});

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startBatchProcessing') {
    processingState = {
      isProcessing: true,
      isPaused: false,
      urls: request.urls,
      currentIndex: 0,
      collectedEmails: []
    };
    
    // Save state
    chrome.storage.local.set({
      isProcessing: true,
      isPaused: false,
      currentIndex: 0
    });
    
    // Start processing
    continueBatchProcessing();
    sendResponse({ status: 'started' });
  }
  
  if (request.action === 'pauseProcessing') {
    processingState.isPaused = true;
    chrome.storage.local.set({ isPaused: true });
    sendResponse({ status: 'paused' });
  }
  
  if (request.action === 'resumeProcessing') {
    processingState.isPaused = false;
    chrome.storage.local.set({ isPaused: false });
    // Resume processing
    continueBatchProcessing();
    sendResponse({ status: 'resumed' });
  }
  
  return true;
});

// Continue batch processing (can be called on resume)
async function continueBatchProcessing() {
  // Check if paused
  if (processingState.isPaused) {
    console.log('Processing paused');
    return;
  }
  
  if (!processingState.isProcessing || processingState.currentIndex >= processingState.urls.length) {
    // Finished
    await finishBatchProcessing();
    return;
  }
  
  const url = processingState.urls[processingState.currentIndex];
  const sourceUrl = url; // Store the original URL from the CSV
  
  try {
    // Send progress update to popup (if open)
    notifyProgress(`Processing: ${getHostname(url)}...`, 'info');
    
    // Open URL in new tab (inactive)
    const tab = await chrome.tabs.create({ url, active: false });
    
    // Set up timeout in case page never loads
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 15000));
    
    // Wait for page to load (with timeout)
    const loadPromise = new Promise((resolve) => {
      const listener = (tabId, info) => {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
    
    await Promise.race([loadPromise, timeoutPromise]);
    
    // Wait for JavaScript and dynamic content
    await sleep(5000);
    
    // Try to extract emails with multiple retry attempts
    let emails = [];
    let contactPages = [];
    let retries = 3;
    
    while (retries > 0) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractEmails' });
        
        if (response) {
          if (response.emails) {
            emails = response.emails;
          }
          if (response.contactPages && response.contactPages.length > 0) {
            contactPages = response.contactPages;
          }
          break;
        }
      } catch (e) {
        console.log(`Retry ${4 - retries} for ${url}:`, e.message);
        retries--;
        if (retries > 0) {
          await sleep(1000); // Wait before retry
        }
      }
    }
    
    // Check if we found a high-priority email (60+) - if so, skip contact pages
    const hasHighPriorityEmail = emails.some(e => e.score >= 60);
    
    // If we found high-priority email, no need to visit contact pages
    if (hasHighPriorityEmail) {
      console.log(`Found high-priority email on main page ${url}, skipping contact pages`);
    } else if (contactPages.length > 0) {
      // Only visit contact pages if we didn't find a good email yet
      console.log(`Found ${contactPages.length} contact pages to visit from ${url}`);
      
      for (const contactPageUrl of contactPages.slice(0, 3)) { // Limit to 3 contact pages per main page
        // Check pause state before each contact page
        if (processingState.isPaused) {
          break;
        }
        
        try {
          // Navigate current tab to contact page
          await chrome.tabs.update(tab.id, { url: contactPageUrl });
          
          // Wait for contact page to load
          await new Promise((resolve) => {
            const listener = (tabId, info) => {
              if (tabId === tab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
            // Timeout after 15 seconds
            setTimeout(resolve, 15000);
          });
          
          await sleep(2000); // Wait for JavaScript
          
          // Extract from contact page
          try {
            const contactResponse = await chrome.tabs.sendMessage(tab.id, { action: 'extractEmails' });
            if (contactResponse && contactResponse.emails) {
              emails = [...emails, ...contactResponse.emails];
              console.log(`Found ${contactResponse.emails.length} emails on contact page: ${contactPageUrl}`);
              
              // Check if we found a high-priority email - if so, stop visiting more contact pages
              const foundHighPriority = contactResponse.emails.some(e => e.score >= 60);
              if (foundHighPriority) {
                console.log(`Found high-priority email on contact page, stopping contact page visits`);
                break;
              }
            }
          } catch (e) {
            console.log(`Error extracting from contact page ${contactPageUrl}:`, e.message);
          }
        } catch (e) {
          console.log(`Error visiting contact page ${contactPageUrl}:`, e.message);
        }
      }
    }
    
    // Load current collected emails from storage
    const result = await chrome.storage.local.get(['collectedEmails']);
    let allEmails = result.collectedEmails || [];
    
    // Process found emails and add sourceUrl
    if (emails.length > 0) {
      // Pick ONLY the best email (highest score) for this URL
      const bestEmail = emails.reduce((best, current) => 
        current.score > best.score ? current : best
      );
      
      // Check if we already have an email from this source URL
      const existingIndex = allEmails.findIndex(e => e.sourceUrl === sourceUrl);
      
      if (existingIndex >= 0) {
        // Replace if new one is better
        if (bestEmail.score > allEmails[existingIndex].score) {
          bestEmail.sourceUrl = sourceUrl;
          allEmails[existingIndex] = bestEmail;
        }
      } else {
        // Add new entry
        bestEmail.sourceUrl = sourceUrl;
        allEmails.push(bestEmail);
      }
      
      notifyProgress(
        `Found ${emails.length} emails, kept best: ${bestEmail.email} (${bestEmail.score} pts) from ${getHostname(url)}`,
        'success',
        [bestEmail] // Only send the best one
      );
    } else {
      // NO emails found - still save the URL with empty email
      const noEmailEntry = {
        email: '',
        name: '',
        score: 0,
        source: 'none',
        context: 'No emails found on this page',
        url: url,
        sourceUrl: sourceUrl
      };
      
      // Only add if we don't already have this URL recorded
      const urlExists = allEmails.find(e => e.sourceUrl === sourceUrl);
      if (!urlExists) {
        allEmails.push(noEmailEntry);
      }
      
      notifyProgress(`No emails found on ${getHostname(url)}`, 'info');
    }
    
    // Save updated emails (whether found or not)
    await chrome.storage.local.set({ collectedEmails: allEmails });
    
    // Close the tab
    try {
      await chrome.tabs.remove(tab.id);
    } catch (e) {
      console.log('Tab already closed');
    }
    
  } catch (error) {
    console.error('Error processing', url, error);
    notifyProgress(`Error on ${getHostname(url)}`, 'error');
  }
  
  // Move to next URL
  processingState.currentIndex++;
  await chrome.storage.local.set({ currentIndex: processingState.currentIndex });
  
  // Check pause state before continuing
  if (processingState.isPaused) {
    console.log('Paused after processing', url);
    return;
  }
  
  // Wait before processing next URL (be polite to servers)
  await sleep(1000);
  
  // Continue with next URL
  continueBatchProcessing();
}

// Finish batch processing
async function finishBatchProcessing() {
  processingState.isProcessing = false;
  
  await chrome.storage.local.set({
    isProcessing: false,
    currentIndex: 0
  });
  
  // Notify popup that processing is complete
  chrome.runtime.sendMessage({
    action: 'batchComplete',
    total: processingState.urls.length
  });
  
  console.log('Batch processing completed');
}

// Send progress update to popup
function notifyProgress(status, statusType, emails = null) {
  chrome.runtime.sendMessage({
    action: 'progressUpdate',
    processed: processingState.currentIndex + 1,
    total: processingState.urls.length,
    status: status,
    statusType: statusType,
    emails: emails
  }).catch(() => {
    // Popup might be closed, that's okay
  });
}

// Helper functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url;
  }
}

// Keep service worker alive during processing
chrome.runtime.onStartup.addListener(() => {
  console.log('Service worker started');
  // Check if we need to resume processing
  chrome.storage.local.get(['isProcessing', 'isPaused', 'urlList', 'currentIndex'], (result) => {
    if (result.isProcessing && result.urlList && !result.isPaused) {
      processingState = {
        isProcessing: true,
        isPaused: false,
        urls: result.urlList,
        currentIndex: result.currentIndex || 0,
        collectedEmails: []
      };
      continueBatchProcessing();
    }
  });
});
