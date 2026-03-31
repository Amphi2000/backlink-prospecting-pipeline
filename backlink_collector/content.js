// content.js - Runs on Google search pages and automatically collects results

console.log('🔍 Backlink Collector Extension Loaded!');
console.log('📍 Current URL:', window.location.href);

// Check if collection is enabled
chrome.storage.local.get(['collectionEnabled', 'currentQuery'], function(result) {
  console.log('⚙️ Settings:', result);
  
  if (result.collectionEnabled) {
    console.log('✅ Auto-collection enabled - collecting now...');
    collectResultsFromPage();
    
    // If auto-next is enabled, automatically click next page
    chrome.storage.local.get(['autoNext'], function(autoNextResult) {
      if (autoNextResult.autoNext) {
        scheduleNextPageClick();
      }
    });
  } else {
    console.log('⏸️ Auto-collection disabled. Click "Collect This Page Now" to manually collect.');
  }
});

function collectResultsFromPage() {
  console.log('🚀 Starting collection...');
  
  const results = [];
  
  // Get the current search query from URL
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('q') || 'Unknown query';
  
  console.log('🔍 Query:', query);
  
  // Try multiple selectors for search results (Google changes these)
  let searchResults = [];
  
  // Method 1: Look for h3 with class LC20lb (current Google layout)
  const h3Elements = document.querySelectorAll('h3.LC20lb');
  if (h3Elements.length > 0) {
    // Get parent containers
    searchResults = Array.from(h3Elements).map(h3 => {
      // Go up to find the container div
      let parent = h3.parentElement;
      while (parent && !parent.querySelector('a[href^="http"]')) {
        parent = parent.parentElement;
        if (parent.tagName === 'BODY') break;
      }
      return parent;
    }).filter(el => el && el.tagName !== 'BODY');
    console.log(`📊 Method 1 (h3.LC20lb parents): Found ${searchResults.length} results`);
  }
  
  // Method 2: Traditional div.g containers
  if (searchResults.length === 0) {
    searchResults = document.querySelectorAll('div.g');
    console.log(`📊 Method 2 (div.g): Found ${searchResults.length} results`);
  }
  
  // Method 3: Try data-sokoban-container
  if (searchResults.length === 0) {
    searchResults = document.querySelectorAll('[data-sokoban-container]');
    console.log(`📊 Method 3 (data-sokoban-container): Found ${searchResults.length} results`);
  }
  
  // Method 4: Try searching for any div with an h3 and link
  if (searchResults.length === 0) {
    const allDivs = document.querySelectorAll('div');
    searchResults = Array.from(allDivs).filter(div => {
      return div.querySelector('h3') && div.querySelector('a[href^="http"]');
    });
    console.log(`📊 Method 4 (div with h3 + link): Found ${searchResults.length} results`);
  }
  
  if (searchResults.length === 0) {
    console.error('❌ Could not find results with any method!');
    console.log('🔍 Let me analyze the page structure...');
    
    // Debug: Show what links we CAN find
    const allLinks = document.querySelectorAll('a[href^="http"]');
    console.log(`🔗 Found ${allLinks.length} total HTTP links on page`);
    
    // Show first few links
    Array.from(allLinks).slice(0, 10).forEach((link, i) => {
      console.log(`  Link ${i + 1}:`, link.href, '|', link.textContent.substring(0, 50));
    });
    
    showNotification('⚠️ No results found - Google may have changed their layout');
    
    // Last resort: Try to collect ANY links that look like search results
    const possibleResults = Array.from(allLinks).filter(link => {
      // Skip Google's own links
      if (link.href.includes('google.com')) return false;
      if (link.href.includes('accounts.google')) return false;
      if (link.href.includes('support.google')) return false;
      if (link.href.includes('policies.google')) return false;
      
      // Must have some text
      return link.textContent.trim().length > 0;
    });
    
    console.log(`🎯 Found ${possibleResults.length} possible result links`);
    
    if (possibleResults.length > 0) {
      console.log('💡 Attempting to collect these links anyway...');
      possibleResults.forEach((link, index) => {
        results.push({
          url: link.href,
          title: link.textContent.trim() || 'No title',
          description: '',
          query: query,
          timestamp: new Date().toISOString(),
          pageNumber: getCurrentPageNumber()
        });
      });
    } else {
      return;
    }
  } else {
    // Normal processing with found containers
    searchResults.forEach((result, index) => {
      try {
        // Extract the link - try multiple methods
        let linkElement = result.querySelector('a[href^="http"]');
        
        if (!linkElement) {
          // Try any link
          linkElement = result.querySelector('a');
        }
        
        if (!linkElement || !linkElement.href) {
          console.log(`⏭️ Result ${index + 1}: No link found, skipping`);
          return;
        }
        
        const url = linkElement.href;
        
        // Skip non-http links and Google's own pages
        if (!url.startsWith('http') || url.includes('google.com/search')) {
          console.log(`⏭️ Result ${index + 1}: Skipping Google link`);
          return;
        }
        
        // Extract title - try multiple selectors
        let title = 'No title';
        const titleElement = result.querySelector('h3.LC20lb') || 
                            result.querySelector('h3') || 
                            result.querySelector('h2') || 
                            result.querySelector('h1');
        if (titleElement) {
          title = titleElement.innerText;
        } else if (linkElement.textContent) {
          title = linkElement.textContent.trim();
        }
        
        // Extract description/snippet - try multiple selectors
        const descSelectors = [
          'div.VwiC3b',
          'div.IsZvec', 
          'span.aCOpRe',
          'div[data-content-feature="1"]',
          'div.s',
          '.st'
        ];
        
        let description = '';
        for (let selector of descSelectors) {
          const descEl = result.querySelector(selector);
          if (descEl && descEl.innerText) {
            description = descEl.innerText;
            break;
          }
        }
        
        console.log(`✅ Result ${index + 1}:`, title.substring(0, 50) + '...');
        
        results.push({
          url: url,
          title: title,
          description: description,
          query: query,
          timestamp: new Date().toISOString(),
          pageNumber: getCurrentPageNumber()
        });
        
      } catch (e) {
        console.error(`❌ Error parsing result ${index + 1}:`, e);
      }
    });
  }
  
  console.log(`📦 Collected ${results.length} valid results`);
  
  if (results.length > 0) {
    // Save to storage
    saveResults(results);
    
    // Show notification
    showNotification(`✅ Collected ${results.length} results from this page`);
  } else {
    showNotification('⚠️ No valid results found');
  }
}

function getCurrentPageNumber() {
  // Try to find current page number
  const pageSpans = document.querySelectorAll('span[aria-label*="Page"]');
  for (let span of pageSpans) {
    const match = span.getAttribute('aria-label').match(/Page (\d+)/);
    if (match) return parseInt(match[1]);
  }
  
  // Check URL for start parameter
  const urlParams = new URLSearchParams(window.location.search);
  const start = parseInt(urlParams.get('start')) || 0;
  return Math.floor(start / 10) + 1;
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch(e) { return url; }
}

function saveResults(newResults) {
  chrome.storage.local.get(['collectedResults', 'seenUrls'], function(result) {
    const existing = result.collectedResults || [];
    const seenUrls = new Set(result.seenUrls || []);

    // Skip anything already seen — compare by root domain
    const trulyNew = newResults.filter(r => !seenUrls.has(getDomain(r.url)));

    // Add new domains to seen set immediately
    trulyNew.forEach(r => seenUrls.add(getDomain(r.url)));

    const combined = [...existing, ...trulyNew];

    chrome.storage.local.set({
      collectedResults: combined,
      totalCollected: combined.length,
      lastCollected: new Date().toISOString(),
      seenUrls: Array.from(seenUrls)
    }, function() {
      console.log('💾 Saved ' + trulyNew.length + ' new (skipped ' + (newResults.length - trulyNew.length) + ' dupes). Total: ' + combined.length);
      chrome.runtime.sendMessage({ action: 'updateBadge', count: combined.length });
    });
  });
}

function scheduleNextPageClick() {
  // Random delay between 5-10 seconds before clicking next
  const delay = Math.random() * 5000 + 5000;
  
  console.log(`⏳ Will click next page in ${(delay/1000).toFixed(1)} seconds...`);
  
  setTimeout(() => {
    // Find and click the "Next" button
    const nextButton = document.querySelector('#pnnext');
    
    if (nextButton) {
      console.log('👉 Clicking next page...');
      
      // Scroll to button first (more human-like)
      nextButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      setTimeout(() => {
        nextButton.click();
      }, 1000);
    } else {
      console.log('🛑 No more pages available');
      showNotification('✅ Reached end of results!');
      
      // Disable auto-next
      chrome.storage.local.set({ autoNext: false });
    }
  }, delay);
}

function showNotification(message) {
  // Create a toast notification on the page
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 999999;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    animation: slideIn 0.3s ease-out;
  `;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('📨 Message received from popup:', request);
  
  if (request.action === 'collectNow') {
    console.log('🎯 Manual collection triggered!');
    collectResultsFromPage();
    sendResponse({ success: true });
  }
  
  return true; // Keep message channel open for async response
});
