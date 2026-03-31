// Content script for Philosophy, Religion & Theology Librarian Email Collector

const EmailCollector = {
  // POSITIVE keywords - Must have at least ONE of these
  positiveKeywords: [
    'philosophy', 'religion', 'theology', 'religious studies',
    'divinity', 'biblical studies', 'theological studies',
    'ethics', 'moral philosophy', 'metaphysics', 'epistemology',
    'religious education', 'sacred texts', 'scripture',
    'faith', 'spirituality', 'christian studies', 'judaism',
    'islam', 'buddhism', 'hinduism', 'world religions',
    'catholic', 'protestant', 'orthodox', 'seminary',
    'pastoral', 'ministry', 'theological', 'philosophical'
  ],

  // NEGATIVE keywords - If ANY of these are present, SKIP the email
  negativeKeywords: [
    'social sciences', 'biology', 'chemistry', 'physics', 'engineering',
    'mathematics', 'computer science', 'psychology', 'sociology',
    'anthropology', 'economics', 'political science', 'history',
    'english', 'literature', 'art', 'music', 'theater', 'drama',
    'business', 'nursing', 'medicine', 'law', 'education',
    'geography', 'geology', 'astronomy', 'statistics',
    'communications', 'journalism', 'marketing', 'finance'
  ],

  // Librarian role keywords
  librarianKeywords: [
    'librarian', 'library specialist', 'subject specialist', 'liaison',
    'resource specialist', 'research librarian', 'reference librarian',
    'collection', 'curator', 'information specialist', 'lib guide',
    'contact librarian', 'subject librarian', 'instruction librarian'
  ],

  // Generic/low-priority patterns (but still collect if on target page)
  genericPatterns: [
    /^library@/i,
    /^info@/i,
    /^support@/i,
    /^help@/i,
    /^contact@/i,
    /^general@/i,
    /^admin@/i,
    /report.*problem/i,
    /^chat@/i,
    /^feedback@/i,
    /^webmaster@/i
  ],

  getFullText(element) {
    return element.textContent || element.innerText || '';
  },

  getEmailContext(element, email) {
    let context = '';
    let current = element;
    let attempts = 0;
    
    while (current && attempts < 5) {
      const text = this.getFullText(current);
      if (text.length > context.length && text.length < 500) {
        context = text;
      }
      current = current.parentElement;
      attempts++;
    }
    
    return context;
  },

  // Check if email should be collected based on context
  isTargetSubject(context, pageUrl) {
    const contextLower = context.toLowerCase();
    const urlLower = pageUrl.toLowerCase();
    
    // FIRST: Check for NEGATIVE keywords (blocking conditions)
    // If any negative keyword is found, immediately reject
    for (const keyword of this.negativeKeywords) {
      if (contextLower.includes(keyword) || urlLower.includes(keyword)) {
        return false; // SKIP - This is for a different subject
      }
    }
    
    // SECOND: Check for POSITIVE keywords (must have at least one)
    // Email context OR page URL must contain a target subject
    for (const keyword of this.positiveKeywords) {
      if (contextLower.includes(keyword) || urlLower.includes(keyword)) {
        return true; // COLLECT - This is Philosophy/Religion/Theology related
      }
    }
    
    return false; // No positive keywords found
  },

  scoreEmail(email, context, pageUrl) {
    const contextLower = context.toLowerCase();
    
    // FIRST: Check if this passes our positive/negative filter
    if (!this.isTargetSubject(context, pageUrl)) {
      return 0; // Skip emails not related to Philosophy/Religion/Theology
    }
    
    let score = 50; // Base score for target subject emails
    
    // MAJOR BOOST for personal emails (firstname.lastname@ pattern)
    const isPersonalEmail = /[a-z]+[a-z0-9]*\.[a-z]+[a-z0-9]*@/i.test(email) || 
                           /^[a-z]+[a-z0-9]*@/i.test(email);
    
    if (isPersonalEmail) {
      score += 30; // Big boost for personal emails
    }
    
    // Check if it's a generic email (lower priority)
    const isGeneric = this.genericPatterns.some(pattern => pattern.test(email));
    if (isGeneric) {
      score -= 25; // Penalize generic emails
    }
    
    // TIER 1: Personal librarian emails (BEST - 80-100 points)
    const hasLibrarianKeyword = this.librarianKeywords.some(kw => contextLower.includes(kw));
    
    if (hasLibrarianKeyword && isPersonalEmail) {
      score = 85; // Personal Philosophy/Religion librarian - PERFECT!
    }
    
    // TIER 2: Department emails (GOOD - 60-79 points)
    else if (email.includes('philosophy') || email.includes('religion') || email.includes('theology')) {
      score = 70; // Department-specific email
    }
    
    // TIER 3: Generic library emails on target pages (OK - 40-59 points)
    else if (isGeneric) {
      score = 45; // Generic library@ on Philosophy page
    }
    
    // Add bonus for librarian role
    if (hasLibrarianKeyword) {
      score += 10;
    }
    
    // Bonus for strong subject keywords in context
    const strongKeywords = ['philosophy librarian', 'religion librarian', 'theology librarian',
                           'philosophical', 'theological', 'religious studies'];
    for (const keyword of strongKeywords) {
      if (contextLower.includes(keyword)) {
        score += 10;
        break;
      }
    }
    
    // Small penalty for support/chat emails (but still collect if on target page)
    if (email.includes('chat') || email.includes('support') || email.includes('help')) {
      score -= 15;
    }
    
    return Math.max(30, Math.min(100, score)); // Clamp between 30-100
  },

  extractName(context) {
    const namePatterns = [
      /contact[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)[,\s]+librarian/i,
      /librarian[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)[,\s]+subject/i,
    ];
    
    for (const pattern of namePatterns) {
      const match = context.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return '';
  },

  async clickContactTabs() {
    const selectors = [
      'a[href*="contact"]',
      'button:contains("contact")',
      'div[role="tab"]:contains("contact")',
      '[aria-label*="contact"]',
      'a:contains("Contact Librarian")',
      'a:contains("Contact")',
      '.tab:contains("contact")',
      '[data-tab*="contact"]'
    ];
    
    const contactLinks = [];
    
    for (const selector of selectors) {
      try {
        let elements;
        if (selector.includes(':contains')) {
          const [baseSelector, containsText] = selector.split(':contains');
          const searchText = containsText.replace(/[()'"]/g, '').toLowerCase();
          elements = Array.from(document.querySelectorAll(baseSelector)).filter(el => 
            el.textContent.toLowerCase().includes(searchText)
          );
        } else {
          elements = document.querySelectorAll(selector);
        }
        
        for (const element of elements) {
          if (!element.offsetParent) continue;
          
          const text = this.getFullText(element).toLowerCase();
          if (text.includes('contact') && text.length < 100) {
            if (element.tagName === 'A' && element.href) {
              const href = element.href;
              if (!href.includes('#') || href.split('#')[0] !== window.location.href.split('#')[0]) {
                contactLinks.push(href);
              } else {
                element.click();
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            } else {
              element.click();
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
      } catch (e) {
        // Continue on error
      }
    }
    
    return contactLinks;
  },

  extractMailtoLinks() {
    const emails = [];
    const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
    const pageUrl = window.location.href;
    
    for (const link of mailtoLinks) {
      const href = link.getAttribute('href');
      const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
      
      if (this.isValidEmail(email)) {
        const context = this.getEmailContext(link, email);
        const score = this.scoreEmail(email, context, pageUrl);
        
        // Only include if score > 0 (meaning it passed positive/negative filter)
        if (score > 0) {
          const name = this.extractName(context);
          
          emails.push({
            email,
            source: 'mailto',
            context: context.substring(0, 200),
            score,
            name,
            url: pageUrl
          });
        }
      }
    }
    
    return emails;
  },

  extractTextEmails() {
    const emails = [];
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const pageUrl = window.location.href;
    
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim().length > 0) {
        textNodes.push(node);
      }
    }
    
    for (const textNode of textNodes) {
      const text = textNode.textContent;
      const matches = text.match(emailRegex);
      
      if (matches) {
        for (const email of matches) {
          const cleanEmail = email.toLowerCase().trim();
          
          if (this.isValidEmail(cleanEmail)) {
            const context = this.getEmailContext(textNode.parentElement, cleanEmail);
            const score = this.scoreEmail(cleanEmail, context, pageUrl);
            
            // Only include if score > 0 (meaning it passed positive/negative filter)
            if (score > 0) {
              const name = this.extractName(context);
              
              emails.push({
                email: cleanEmail,
                source: 'text',
                context: context.substring(0, 200),
                score,
                name,
                url: pageUrl
              });
            }
          }
        }
      }
    }
    
    return emails;
  },

  isValidEmail(email) {
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/i.test(email)) {
      return false;
    }
    
    const invalidPatterns = [
      'example.com',
      'test.com',
      'domain.com',
      'email.com',
      'yoursite.com',
      'noreply',
      'no-reply',
      'donotreply'
    ];
    
    for (const pattern of invalidPatterns) {
      if (email.includes(pattern)) {
        return false;
      }
    }
    
    return true;
  },

  // Extract "Report a Problem" emails as last resort fallback
  extractReportProblemEmails() {
    const emails = [];
    const pageUrl = window.location.href;
    
    // Look for "Report a Problem", "Feedback", or similar links
    const reportSelectors = [
      'a[href*="problem"]',
      'a[href*="report"]',
      'a[href*="feedback"]'
    ];
    
    const reportTextPatterns = ['report', 'problem', 'feedback', 'contact us', 'help'];
    
    // Find all links
    const allLinks = document.querySelectorAll('a[href^="mailto:"]');
    
    for (const link of allLinks) {
      const linkText = link.textContent.toLowerCase().trim();
      const linkHref = link.href.toLowerCase();
      
      // Check if this looks like a "report a problem" link
      const isReportLink = reportTextPatterns.some(pattern => 
        linkText.includes(pattern) || linkHref.includes(pattern)
      );
      
      if (isReportLink && link.href.startsWith('mailto:')) {
        const email = link.href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
        
        if (this.isValidEmail(email)) {
          emails.push({
            email,
            source: 'report-problem',
            context: `Report/Feedback link: ${linkText.substring(0, 50)}`,
            score: 30, // Low score since it's a fallback
            name: '',
            url: pageUrl
          });
        }
      }
    }
    
    return emails;
  },

  async extractAll() {
    const contactPageLinks = await this.clickContactTabs();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mailtoEmails = this.extractMailtoLinks();
    const textEmails = this.extractTextEmails();
    
    let allEmails = [...mailtoEmails, ...textEmails];
    
    // If NO emails found at all, try "Report a Problem" links as fallback
    if (allEmails.length === 0) {
      console.log('No emails found, checking Report a Problem links...');
      const reportEmails = this.extractReportProblemEmails();
      allEmails = [...allEmails, ...reportEmails];
    }
    
    const uniqueEmails = new Map();
    
    for (const emailData of allEmails) {
      const existing = uniqueEmails.get(emailData.email);
      if (!existing || emailData.score > existing.score) {
        uniqueEmails.set(emailData.email, emailData);
      }
    }
    
    const sortedEmails = Array.from(uniqueEmails.values())
      .sort((a, b) => b.score - a.score);
    
    return {
      emails: sortedEmails,
      contactPages: contactPageLinks,
      url: window.location.href // Always include the URL
    };
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractEmails') {
    EmailCollector.extractAll().then(result => {
      sendResponse(result);
    });
    return true;
  }
});
