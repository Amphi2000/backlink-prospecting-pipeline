# 📧 Email Collector

A Chrome extension to collect Philosophy, Religion, and Theology librarian emails for academic and ministry outreach.

## ✨ What Makes This Special

### 🎯 Smart Subject Filtering

This extension uses **positive and negative keyword matching** to ONLY collect emails related to Philosophy, Religion, and Theology:

**✅ COLLECTS:**
- Personal librarian emails on Philosophy/Religion pages (like `hardenbergw1@southernct.edu`)
- Department emails (like `philosophy@library.edu`)
- Generic library emails IF found on Philosophy/Religion pages (like `library@` on a Religion LibGuide)

**❌ SKIPS:**
- Social Sciences librarians
- Biology, Chemistry, Physics librarians
- Any other subject librarians
- Emails found on non-Philosophy/Religion pages

### 📊 Intelligent Scoring System

**Tier 1: Personal Librarians (80-100 points)** 🟢
- Philosophy/Religion librarian with personal email
- Example: `sarah.johnson@university.edu` (Philosophy Librarian)
- **These are your PRIMARY targets!**

**Tier 2: Department Emails (60-79 points)** 🟡
- Department-specific addresses
- Example: `philosophy@library.edu` or `religion.dept@university.edu`
- **Great backup contacts**

**Tier 3: Generic Library Emails (40-59 points)** ⚪
- Generic addresses found on Philosophy/Religion pages
- Example: `library@university.edu` (found on Philosophy & Religion LibGuide)
- **Use as last resort**

## 🚀 How It Works

### The Filtering Magic

1. **Page URL Check**: Is the URL a Philosophy/Religion page?
   - ✅ `guides.library.edu/philosophy` → COLLECT
   - ❌ `guides.library.edu/biology` → SKIP

2. **Context Analysis**: What's written near the email?
   - ✅ "Philosophy Librarian" → COLLECT
   - ✅ "Religious Studies Specialist" → COLLECT
   - ❌ "Social Sciences Librarian" → SKIP

3. **Dual Filter System**:
   - **Positive keywords** (must have ONE): philosophy, religion, theology, ethics, divinity, faith, etc.
   - **Negative keywords** (if found, REJECT): biology, chemistry, social sciences, engineering, etc.

### Example Scenarios

**Scenario 1: Philosophy LibGuide** ✅
```
URL: https://guides.library.harvard.edu/philosophy
Found: library@harvard.edu
Result: ✅ COLLECTED (score: 45)
Why: Found on a Philosophy page (URL contains "philosophy")
```

**Scenario 2: Personal Philosophy Librarian** ✅
```
URL: https://guides.library.yale.edu/prf.php?account_id=123
Context: "Contact Dr. Sarah Johnson, Philosophy & Religion Librarian"
Found: sarah.johnson@yale.edu
Result: ✅ COLLECTED (score: 85)
Why: Personal email + "Philosophy & Religion Librarian" in context
```

**Scenario 3: Biology Librarian** ❌
```
URL: https://guides.library.princeton.edu/biology
Context: "Contact John Smith, Biology Subject Librarian"
Found: john.smith@princeton.edu
Result: ❌ SKIPPED (score: 0)
Why: Context contains "biology" (negative keyword)
```

**Scenario 4: Generic Email on Social Sciences Page** ❌
```
URL: https://guides.library.columbia.edu/socialsciences
Found: library@columbia.edu
Result: ❌ SKIPPED (score: 0)
Why: URL contains "social sciences" (negative keyword)
```

## 📋 Installation

1. Download all extension files to a folder
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the extension folder
6. Pin the extension to your toolbar

## 🎯 Usage

### Method 1: Single Page Collection

1. Navigate to a Philosophy or Religion LibGuide
2. Click the extension icon
3. Click "📄 Collect from Current Page"
4. Watch emails appear with their scores

### Method 2: Batch Collection

1. Create a CSV file with LibGuide URLs:
```csv
https://guides.library.harvard.edu/philosophy
https://libguides.princeton.edu/religion
https://guides.library.yale.edu/theology
```

2. Click "📁 Upload Library URLs"
3. Select your CSV file
4. Click "🚀 Start Batch Collection"
5. Close the popup - it runs in the background!
6. Reopen anytime to check progress

## 📊 Understanding Your Results

### High Priority Emails (80+ points) 🟢
These are **exactly what you want**:
- Personal emails of Philosophy/Religion librarians
- Direct contacts with names
- Subject specialists

**Example:**
```
hardenbergw1@southernct.edu (Score: 85)
👤 Bill Hardenberg
📍 Philosophy & Religion Librarian
```

### Medium Priority (60-79 points) 🟡
Good backup contacts:
- Department-specific emails
- Subject liaison addresses

**Example:**
```
philosophy@library.edu (Score: 70)
📍 Philosophy Department
```

### Lower Priority (40-59 points) ⚪
Generic contacts on target pages:
- library@ addresses found on Philosophy pages
- General reference emails

**Example:**
```
library@university.edu (Score: 45)
📍 Found on: Philosophy & Religion Guide
```

## 💾 Exporting Results

Click "💾 Export Results to CSV" to download a file with:
- Source URL (the original CSV URL you provided)
- Email address
- Name (if found)
- Score
- Priority level
- Context (surrounding text)
- Found On URL (where it was discovered)

**Results are automatically sorted** with highest-scoring emails first!

## 🎨 UI Features

### Modern Purple Gradient Design
- Clean, professional interface
- Smooth animations
- Color-coded email scores
- Real-time progress tracking

### Smart Status Messages
- Know exactly what's happening
- See which page is being processed
- Get notified of errors
- Track high-priority finds

## 🔍 What Gets Collected

### ✅ YES - These Are Collected

**On Philosophy Pages:**
- `philosophy.librarian@university.edu` (personal)
- `philosophy@library.edu` (department)
- `library@university.edu` (generic, but on Philosophy page)

**Context Mentions:**
- "Philosophy Librarian"
- "Religion Subject Specialist"
- "Theology Liaison"
- "Ethics & Philosophy"

### ❌ NO - These Are Skipped

**Wrong Subject:**
- Biology librarian on Biology page
- Social Sciences liaison
- Chemistry subject specialist
- Engineering library contact

**Wrong Context:**
- Email found on Biology page
- "Social Sciences Librarian" in context
- Generic email on wrong subject page

## 🎓 Perfect For Ministry Outreach

This tool is ideal if you're:
- Reaching out to academic Philosophy departments
- Contacting Religion/Theology librarians
- Building relationships with seminaries
- Promoting faith-based resources
- Connecting with Christian academic institutions

## 📝 Tips for Best Results

### 1. **Use LibGuide URLs**
Best URLs to collect from:
- `https://guides.library.*/philosophy`
- `https://libguides.*/religion`
- `https://guides.*/theology`
- `https://*/prf.php?account_id=*` (LibGuides profile pages)

### 2. **Include Staff Directories**
Also try:
- `/staff/philosophy-librarian`
- `/about/subject-specialists`
- `/contact/philosophy`

### 3. **Export and Sort**
- Export to CSV
- Focus on scores 60+ first
- Use high-priority emails for direct outreach
- Keep lower-priority as backup

### 4. **Personalize Your Outreach**
- Use the "Name" field from exports
- Reference their subject area
- Mention specific philosophy/theology interests

## 🔒 Privacy & Permissions

**What the extension can access:**
- Active tab content (to extract emails)
- Chrome storage (to save your data locally)
- Page scripting (to click tabs and find hidden content)

**What it does NOT do:**
- Send data to external servers
- Track your browsing
- Access unrelated pages
- Share any information

**All data stays on your computer!**

## 🛠️ Technical Details

### Positive Keywords (Must Have One)
```
philosophy, religion, theology, religious studies, divinity,
biblical studies, ethics, moral philosophy, metaphysics,
spirituality, faith, christian studies, judaism, islam,
buddhism, hinduism, world religions, seminary, pastoral
```

### Negative Keywords (Auto-Reject)
```
social sciences, biology, chemistry, physics, engineering,
mathematics, computer science, psychology, sociology,
anthropology, economics, political science, history,
english, literature, art, music, business, nursing,
medicine, law, education, geography, geology
```

### Scoring Logic
```javascript
// Personal Philosophy/Religion Librarian
hasLibrarianKeyword + isPersonalEmail + positiveKeywords
→ Score: 85 (HIGH PRIORITY)

// Department Email
email.contains('philosophy|religion|theology')
→ Score: 70 (GOOD)

// Generic on Target Page
genericEmail + foundOnPhilosophyPage
→ Score: 45 (OK)

// Wrong Subject
negativeKeyword in context
→ Score: 0 (SKIP)
```

## 📈 Example Workflow

1. **Google search**: 
   ```
   site:.edu library guides philosophy
   site:.edu library guides religion
   site:.edu libguides theology
   ```

2. **Copy URLs** from search results

3. **Create CSV**:
   ```csv
   https://guides.library.harvard.edu/philosophy
   https://libguides.princeton.edu/religion
   https://guides.library.yale.edu/theology
   https://library.duke.edu/staff/philosophy-librarian
   ```

4. **Upload & Process** with the extension

5. **Export Results** sorted by priority

6. **Start Outreach** with high-priority emails first

## 🎯 Success Metrics

What to expect:
- **30-50% of pages** will have high-priority emails (60+ score)
- **70-80% of pages** will have some usable email
- **Personal librarian emails** (80+ score) are the goldmine
- **Generic emails** on Philosophy pages are decent backups

## ❓ Troubleshooting

**"No emails found"**
- Page might not have Philosophy/Religion content
- Try the specific LibGuide URL, not homepage
- Some pages require login (extension can't bypass)

**"Only finding generic emails"**
- Personal librarian info might be on a linked profile page
- Extension will try to find and visit "Contact Librarian" links
- Try the staff directory page directly

**"Processing is slow"**
- Extension waits 3 seconds per page (to load JavaScript)
- Also visits contact pages it finds
- This is intentional to get complete data

## 🌟 Key Advantages

1. **Subject-Specific**: Only Philosophy/Religion/Theology
2. **Smart Filtering**: Skips irrelevant emails automatically
3. **Priority Scoring**: Know which emails to use first
4. **Background Processing**: Runs while you work
5. **Never Lose Data**: Everything saves automatically
6. **Export Ready**: CSV formatted for outreach tools

## 📧 Perfect Output Example

```csv
Source URL,Email,Name,Score,Priority,Context
"https://guides.library.harvard.edu/philosophy","sarah.johnson@harvard.edu","Sarah Johnson",85,"High","Philosophy & Religion Librarian"
"https://guides.library.harvard.edu/philosophy","philosophy@library.harvard.edu","",70,"Medium","Philosophy Department Contact"
"https://guides.library.harvard.edu/philosophy","library@harvard.edu","",45,"OK","Found on Philosophy & Religion Guide"
```

## 🎉 Ready to Start?

1. Load the extension
2. Upload your LibGuide URLs
3. Click "Start Batch Collection"
4. Get coffee while it works
5. Export sorted results
6. Begin your outreach!

---

**Built for Christian ministry outreach • Focus on quality over quantity • Smart filtering for relevant contacts**
