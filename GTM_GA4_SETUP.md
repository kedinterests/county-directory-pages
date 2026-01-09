# GTM & GA4 Setup Guide: Advertiser Directory Tracking

This guide will help you set up Google Tag Manager and Google Analytics 4 to track which directories each advertiser appears on.

## ⚠️ IMPORTANT: New Tracking Method (Solution A)

We now send **individual events for each advertiser** (`directory_advertiser_present`) to avoid GA4's 100-character parameter limit. This allows you to filter by any advertiser name without truncation issues.

The original `directory_page_view` event is still sent for backward compatibility, but **use `directory_advertiser_present` events for advertiser-specific reports**.

---

## Part 1: GA4 Custom Dimensions Setup

### Step 1: Create Custom Dimensions in GA4

1. Go to **Google Analytics 4** → **Admin** (gear icon)
2. Under **Property**, click **Custom definitions**
3. Click **Create custom dimension**

Create these custom dimensions:

#### ✅ KEEP: Dimension 1: Directory Advertiser Names (for backward compatibility)
- **Dimension name**: `Directory Advertiser Names`
- **Scope**: `Event`
- **Event parameter**: `directory_advertiser_names_string`
- **Description**: "Comma-separated list of all advertiser names on the directory page (may be truncated)"

#### ✅ KEEP: Dimension 2: Directory Advertiser Count
- **Dimension name**: `Directory Advertiser Count`
- **Scope**: `Event`
- **Event parameter**: `directory_advertiser_count`
- **Description**: "Total number of advertisers on the directory page"

#### ✅ KEEP: Dimension 3: Directory Advertiser Website URLs
- **Dimension name**: `Directory Advertiser Website URLs`
- **Scope**: `Event`
- **Event parameter**: `directory_advertiser_website_urls`
- **Description**: "Comma-separated list of all advertiser website URLs (including UTM parameters) on the directory page"

#### ➕ ADD: Dimension 4: Advertiser Name (NEW - Primary method)
- **Dimension name**: `Advertiser Name`
- **Scope**: `Event`
- **Event parameter**: `advertiser_name`
- **Description**: "Individual advertiser name from directory_advertiser_present events (no truncation)"

#### ➕ ADD: Dimension 5: Directory Page Path (NEW)
- **Dimension name**: `Directory Page Path`
- **Scope**: `Event`
- **Event parameter**: `page_path`
- **Description**: "Page path where the advertiser appears"

**Note**: It may take 24-48 hours for custom dimensions to appear in GA4 reports after creation.

---

## Part 2: GTM Setup Instructions

### Step 1: Create DataLayer Variables

1. Go to **Google Tag Manager** → Your Container
2. Click **Variables** → **New**

#### ✅ KEEP: Existing Variables (for backward compatibility)

#### Variable 1: Directory Advertiser Names String
- **Variable Name**: `DLV - Directory Advertiser Names String`
- **Variable Type**: `Data Layer Variable`
- **Data Layer Variable Name**: `directory_advertiser_names_string`
- **Data Layer Version**: `Version 2`
- Click **Save**

#### Variable 2: Directory Advertiser Count
- **Variable Name**: `DLV - Directory Advertiser Count`
- **Variable Type**: `Data Layer Variable`
- **Data Layer Variable Name**: `directory_advertiser_count`
- **Data Layer Version**: `Version 2`
- Click **Save**

#### Variable 3: Directory Advertiser Names Array
- **Variable Name**: `DLV - Directory Advertiser Names Array`
- **Variable Type**: `Data Layer Variable`
- **Data Layer Variable Name**: `directory_advertiser_names`
- **Data Layer Version**: `Version 2`
- Click **Save**

#### Variable 4: Directory Advertiser Website URLs
- **Variable Name**: `DLV - Directory Advertiser Website URLs`
- **Variable Type**: `Data Layer Variable`
- **Data Layer Variable Name**: `directory_advertiser_website_urls`
- **Data Layer Version**: `Version 2`
- Click **Save**

#### ➕ ADD: New Variables (for individual advertiser tracking)

#### Variable 5: Advertiser Name (NEW)
- **Variable Name**: `DLV - Advertiser Name`
- **Variable Type**: `Data Layer Variable`
- **Data Layer Variable Name**: `advertiser_name`
- **Data Layer Version**: `Version 2`
- Click **Save**

#### Variable 6: Page Path (NEW)
- **Variable Name**: `DLV - Page Path`
- **Variable Type**: `Data Layer Variable`
- **Data Layer Variable Name**: `page_path`
- **Data Layer Version**: `Version 2`
- Click **Save**

---

### Step 2: Create Triggers

#### ✅ KEEP: Existing Trigger

1. Go to **Triggers** → **New**
2. **Trigger Name**: `TRG - Directory Page View`
3. **Trigger Type**: `Custom Event`
4. **Event name**: `directory_page_view`
5. **This trigger fires on**: `All Custom Events`
6. Click **Save**

#### ➕ ADD: New Trigger (Primary method)

1. Go to **Triggers** → **New**
2. **Trigger Name**: `TRG - Directory Advertiser Present`
3. **Trigger Type**: `Custom Event`
4. **Event name**: `directory_advertiser_present`
5. **This trigger fires on**: `All Custom Events`
6. Click **Save**

---

### Step 3: Create GA4 Event Tags

#### ✅ KEEP: Existing Tag (for backward compatibility)

1. Go to **Tags** → **New**
2. **Tag Name**: `GA4 - Directory Page View`
3. **Tag Type**: `Google Analytics: GA4 Event`
4. **Configuration Tag**: Select your existing GA4 Configuration tag
5. **Event Name**: `directory_page_view`

#### Add Event Parameters:
Click **Add Row** for each parameter:

- **Parameter Name**: `directory_advertiser_names_string`
  - **Value**: `{{DLV - Directory Advertiser Names String}}`

- **Parameter Name**: `directory_advertiser_count`
  - **Value**: `{{DLV - Directory Advertiser Count}}`

- **Parameter Name**: `directory_advertiser_website_urls`
  - **Value**: `{{DLV - Directory Advertiser Website URLs}}`

6. **Triggering**: Select `TRG - Directory Page View`
7. Click **Save**

#### ➕ ADD: New Tag (Primary method - use this for advertiser reports)

1. Go to **Tags** → **New**
2. **Tag Name**: `GA4 - Directory Advertiser Present`
3. **Tag Type**: `Google Analytics: GA4 Event`
4. **Configuration Tag**: Select your existing GA4 Configuration tag
5. **Event Name**: `directory_advertiser_present`

#### Add Event Parameters:
Click **Add Row** for each parameter:

- **Parameter Name**: `advertiser_name`
  - **Value**: `{{DLV - Advertiser Name}}`

- **Parameter Name**: `page_path`
  - **Value**: `{{DLV - Page Path}}`

- **Parameter Name**: `directory_advertiser_count`
  - **Value**: `{{DLV - Directory Advertiser Count}}`

6. **Triggering**: Select `TRG - Directory Advertiser Present`
7. Click **Save**

---

## Part 3: Testing in GTM Preview Mode

1. Click **Preview** in GTM
2. Enter your directory page URL
3. Verify:
   - The `directory_page_view` event fires (1 time per page)
   - The `directory_advertiser_present` event fires (multiple times - once per advertiser)
   - Variables show correct values:
     - `DLV - Advertiser Name` = individual advertiser name (no truncation)
     - `DLV - Page Path` = page path
     - `DLV - Directory Advertiser Count` = number
   - GA4 tags fire with correct parameters

---

## Part 4: Accessing Data in Looker Studio (Google Data Studio)

### Step 1: Create Looker Studio Report

1. Go to **Looker Studio** (datastudio.google.com)
2. Click **Create** → **Data Source**
3. Select **Google Analytics 4**
4. Connect to your GA4 property

### Step 2: Create Advertiser-Specific Report (NEW - Recommended Method)

#### For "Directories per Advertiser" Report:

1. In your report, click **Add a chart**
2. Create a **Table** chart
3. Add these dimensions:
   - `Advertiser Name` (your custom dimension - **use this instead of Directory Advertiser Names**)
   - `Directory Page Path` (or `Page path`)
   - `Event name` (filter to `directory_advertiser_present`)

4. Add metrics:
   - `Event count` (this = page views for that advertiser on that directory)

5. **Add a filter** to show specific advertiser:
   - **Dimension**: `Advertiser Name`
   - **Operator**: `Equal to` (or `Contains text`)
   - **Value**: Enter advertiser name (e.g., "Caldwell Clark Fanucchi & Finlayson")

#### Example: Advertiser Performance Report

**Table Setup:**
- **Row Dimension**: `Directory Page Path`
- **Metrics**:
  - `Views` = Event count (filter: `Event name` = `directory_advertiser_present`)
  - `Email Clicks` = Event count (filter: `Event name` = `email_click` AND `Company Name` = "Caldwell Clark Fanucchi & Finlayson")
  - `Phone Clicks` = Event count (filter: `Event name` = `phone_click` AND `Company Name` = "Caldwell Clark Fanucchi & Finlayson")

**Report Filter:**
- `Advertiser Name` = "Caldwell Clark Fanucchi & Finlayson"

This will show all directories where that advertiser appears, with their views and clicks.

---

### Step 3: ✅ KEEP - Legacy Method (for backward compatibility)

If you need to use the old `directory_page_view` events:

1. Create a **Table** chart
2. Add these dimensions:
   - `Event name` (filter to `directory_page_view`)
   - `Directory Advertiser Names` (your custom dimension - **may be truncated**)
   - `Directory Advertiser Count` (your custom dimension)
   - `Directory Advertiser Website URLs` (your custom dimension)
   - `Page path` or `Page title` (to see which directory)

**⚠️ Note**: The `Directory Advertiser Names` dimension may be truncated at 100 characters, so some advertisers may not appear in filters.

---

## Part 5: Sample Looker Studio Formulas

### ✅ DELETE: Old formulas that rely on truncated strings

~~### Count Unique Directories per Advertiser~~
~~```
COUNT_DISTINCT(CASE 
  WHEN CONTAINS_TEXT(Directory Advertiser Names, "Advertiser Name") 
  THEN Page Path 
END)
```~~

### ➕ ADD: New Formulas (use these instead)

#### Count Unique Directories per Advertiser
```
COUNT_DISTINCT(CASE 
  WHEN Advertiser Name = "Caldwell Clark Fanucchi & Finlayson" 
  THEN Directory Page Path 
END)
```

#### List All Directories for an Advertiser
Create a filter:
- **Dimension**: `Advertiser Name`
- **Operator**: `Equal to`
- **Value**: `Caldwell Clark Fanucchi & Finlayson`

Then show `Directory Page Path` or `Page Path` dimension.

#### Advertiser Appears on Directory (Boolean)
Create a calculated field:
```
Advertiser Name = "Caldwell Clark Fanucchi & Finlayson"
```

#### Count Page Views per Advertiser per Directory
Simply use `Event count` metric filtered to `directory_advertiser_present` events, grouped by `Advertiser Name` and `Directory Page Path`.

---

## Troubleshooting

### Data not appearing in GA4?
1. Wait 24-48 hours after creating custom dimensions
2. Check GTM Preview mode to verify events are firing
3. Check GA4 DebugView (Admin → DebugView) to see real-time events
4. Verify custom dimension parameter names match exactly
5. **Verify `directory_advertiser_present` events are firing** (should see multiple per page - one per advertiser)

### Data not appearing in Looker Studio?
1. Refresh your data source
2. Verify custom dimensions are added to your GA4 data source
3. Check that the date range includes data
4. Ensure you're filtering by the correct event name (`directory_advertiser_present` for new reports)
5. **Make sure you're using `Advertiser Name` dimension, not `Directory Advertiser Names`** (which may be truncated)

### Need to track individual advertiser clicks?
Use the existing `email_click` and `phone_click` events that already include `company_name` parameter - you can create a custom dimension for that too!

---

## Quick Reference

### ✅ KEEP: DataLayer Structure (for backward compatibility)
```javascript
{
  event: 'directory_page_view',
  directory_advertiser_names: ['Company A', 'Company B', ...],
  directory_advertiser_names_string: 'Company A, Company B, ...',
  directory_advertiser_count: 25,
  directory_advertiser_website_urls: 'https://company-a.com?utm_source=directory, ...'
}
```

### ➕ ADD: New DataLayer Structure (primary method)
```javascript
{
  event: 'directory_advertiser_present',
  advertiser_name: 'Caldwell Clark Fanucchi & Finlayson',
  page_path: '/mineral-county-directory',
  directory_advertiser_count: 25
}
```

**Note**: This event fires once per advertiser on the page, so a page with 25 advertisers will send 25 `directory_advertiser_present` events.

### GA4 Event Parameters:

#### ✅ KEEP (for backward compatibility):
- `directory_advertiser_names_string` → Custom Dimension: "Directory Advertiser Names" (may be truncated)
- `directory_advertiser_count` → Custom Dimension: "Directory Advertiser Count"
- `directory_advertiser_website_urls` → Custom Dimension: "Directory Advertiser Website URLs"

#### ➕ ADD (primary method):
- `advertiser_name` → Custom Dimension: "Advertiser Name" (**no truncation**)
- `page_path` → Custom Dimension: "Directory Page Path"

### GTM Variables Needed:

#### ✅ KEEP:
- `DLV - Directory Advertiser Names String`
- `DLV - Directory Advertiser Count`
- `DLV - Directory Advertiser Names Array` (optional)
- `DLV - Directory Advertiser Website URLs`

#### ➕ ADD:
- `DLV - Advertiser Name` (**use this for new reports**)
- `DLV - Page Path`

### GTM Triggers:

#### ✅ KEEP:
- Event name: `directory_page_view`

#### ➕ ADD:
- Event name: `directory_advertiser_present` (**use this for new reports**)

---

## Summary: What Changed?

### ✅ KEEP (for backward compatibility):
- All existing `directory_page_view` tracking
- All existing GTM variables, triggers, and tags
- Existing custom dimensions (though `Directory Advertiser Names` may truncate)

### ➕ ADD (new primary method):
- `directory_advertiser_present` events (one per advertiser)
- New GTM variables: `DLV - Advertiser Name`, `DLV - Page Path`
- New GTM trigger: `TRG - Directory Advertiser Present`
- New GTM tag: `GA4 - Directory Advertiser Present`
- New custom dimensions: `Advertiser Name`, `Directory Page Path`

### ❌ DELETE/REPLACE:
- **In Looker Studio**: Stop using `Directory Advertiser Names` dimension for filtering (it truncates)
- **Use instead**: `Advertiser Name` dimension from `directory_advertiser_present` events
- Old Looker Studio formulas that rely on `CONTAINS_TEXT(Directory Advertiser Names, ...)` - replace with direct `Advertiser Name` filtering

### 🎯 Use Case Example:

**Old way (truncation issues):**
- Filter: `Directory Advertiser Names` contains "Caldwell"
- Problem: If "Caldwell" appears after character 100, it won't match

**New way (no truncation):**
- Filter: `Advertiser Name` = "Caldwell Clark Fanucchi & Finlayson"
- Event: `directory_advertiser_present`
- Result: Works perfectly, no truncation issues!
