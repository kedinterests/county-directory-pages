# GTM & GA4 Setup Guide: Advertiser Directory Tracking

This guide will help you set up Google Tag Manager and Google Analytics 4 to track which directories each advertiser appears on.

## Part 1: GA4 Custom Dimensions Setup

### Step 1: Create Custom Dimensions in GA4

1. Go to **Google Analytics 4** → **Admin** (gear icon)
2. Under **Property**, click **Custom definitions**
3. Click **Create custom dimension**

Create **3 custom dimensions**:

#### Dimension 1: Directory Advertiser Names
- **Dimension name**: `Directory Advertiser Names`
- **Scope**: `Event`
- **Event parameter**: `directory_advertiser_names_string`
- **Description**: "Comma-separated list of all advertiser names on the directory page"

#### Dimension 2: Directory Advertiser Count
- **Dimension name**: `Directory Advertiser Count`
- **Scope**: `Event`
- **Event parameter**: `directory_advertiser_count`
- **Description**: "Total number of advertisers on the directory page"

**Note**: It may take 24-48 hours for custom dimensions to appear in GA4 reports after creation.

---

## Part 2: GTM Setup Instructions

### Step 1: Create DataLayer Variables

1. Go to **Google Tag Manager** → Your Container
2. Click **Variables** → **New**
3. Create these **3 User-Defined Variables**:

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

#### Variable 3: Directory Advertiser Names Array (for advanced use)
- **Variable Name**: `DLV - Directory Advertiser Names Array`
- **Variable Type**: `Data Layer Variable`
- **Data Layer Variable Name**: `directory_advertiser_names`
- **Data Layer Version**: `Version 2`
- Click **Save**

---

### Step 2: Create Trigger

1. Go to **Triggers** → **New**
2. **Trigger Name**: `TRG - Directory Page View`
3. **Trigger Type**: `Custom Event`
4. **Event name**: `directory_page_view`
5. **This trigger fires on**: `All Custom Events`
6. Click **Save**

---

### Step 3: Create GA4 Event Tag

1. Go to **Tags** → **New**
2. **Tag Name**: `GA4 - Directory Page View`
3. **Tag Type**: `Google Analytics: GA4 Event`
4. **Configuration Tag**: Select your existing GA4 Configuration tag (or create one if needed)
5. **Event Name**: `directory_page_view`

#### Add Event Parameters:
Click **Add Row** for each parameter:

- **Parameter Name**: `directory_advertiser_names_string`
  - **Value**: `{{DLV - Directory Advertiser Names String}}`

- **Parameter Name**: `directory_advertiser_count`
  - **Value**: `{{DLV - Directory Advertiser Count}}`

6. **Triggering**: Select `TRG - Directory Page View`
7. Click **Save**

---

### Step 4: Optional - Create Individual Advertiser Events (Advanced)

If you want to track each advertiser individually (recommended for detailed analysis):

**Note**: Since `advertiser_name` is already in use elsewhere, use the comma-separated string in Looker Studio and split it there, or create individual events with a different parameter name like `directory_advertiser_name` if needed.

**Simpler Alternative**: Use the comma-separated string (`directory_advertiser_names_string`) in Looker Studio and split it there using formulas.

---

## Part 3: Testing in GTM Preview Mode

1. Click **Preview** in GTM
2. Enter your directory page URL
3. Verify:
   - The `directory_page_view` event fires
   - Variables show correct values:
     - `DLV - Directory Advertiser Names String` = comma-separated list
     - `DLV - Directory Advertiser Count` = number
   - GA4 tag fires with correct parameters

---

## Part 4: Accessing Data in Looker Studio (Google Data Studio)

### Step 1: Create Looker Studio Report

1. Go to **Looker Studio** (datastudio.google.com)
2. Click **Create** → **Data Source**
3. Select **Google Analytics 4**
4. Connect to your GA4 property

### Step 2: Add Custom Dimensions to Report

1. In your report, click **Add a chart**
2. Create a **Table** chart
3. Add these dimensions:
   - `Event name` (filter to `directory_page_view`)
   - `Directory Advertiser Names` (your custom dimension)
   - `Directory Advertiser Count` (your custom dimension)
   - `Page path` or `Page title` (to see which directory)

### Step 3: Create Advertiser-Specific Analysis

To see which directories each advertiser appears on:

1. Create a **Filter**:
   - **Dimension**: `Advertiser Names`
   - **Operator**: `Contains`
   - **Value**: Enter advertiser name (e.g., "Company Name")

2. Or create a **Calculated Field** to split the comma-separated list:
   - **Field Name**: `Individual Advertiser`
   - **Formula**: 
   ```
   SPLIT(Directory Advertiser Names, ", ")
   ```
   Note: This creates an array that you can use in charts

### Step 4: Create Dashboard Views

**View 1: Directories per Advertiser**
- Filter by advertiser name using `Directory Advertiser Names` dimension
- Show all directories (page paths) where that advertiser appears

**View 2: Advertisers per Directory**
- Group by page path/page title
- Show advertiser names (`Directory Advertiser Names`) and count (`Directory Advertiser Count`) for each directory

**View 3: Advertiser Coverage**
- Table showing each advertiser and how many directories they appear on
- Use calculated metrics to count unique directories per advertiser using `Directory Advertiser Names`

---

## Part 5: Sample Looker Studio Formulas

### Count Unique Directories per Advertiser
```
COUNT_DISTINCT(CASE 
  WHEN CONTAINS_TEXT(Directory Advertiser Names, "Advertiser Name") 
  THEN Page Path 
END)
```

### List All Directories for an Advertiser
Create a filter:
- **Dimension**: `Directory Advertiser Names`
- **Condition**: `Contains text`
- **Value**: `Your Advertiser Name`

Then show `Page Path` or `Page Title` dimension.

### Advertiser Appears on Directory (Boolean)
Create a calculated field:
```
CONTAINS_TEXT(Directory Advertiser Names, "Advertiser Name")
```

---

## Troubleshooting

### Data not appearing in GA4?
1. Wait 24-48 hours after creating custom dimensions
2. Check GTM Preview mode to verify events are firing
3. Check GA4 DebugView (Admin → DebugView) to see real-time events
4. Verify custom dimension parameter names match exactly

### Data not appearing in Looker Studio?
1. Refresh your data source
2. Verify custom dimensions are added to your GA4 data source
3. Check that the date range includes data
4. Ensure you're filtering by the correct event name

### Need to track individual advertiser clicks?
Use the existing `email_click` and `phone_click` events that already include `company_name` parameter - you can create a custom dimension for that too!

---

## Quick Reference

**DataLayer Structure**:
```javascript
{
  event: 'directory_page_view',
  directory_advertiser_names: ['Company A', 'Company B', ...],
  directory_advertiser_names_string: 'Company A, Company B, ...',
  directory_advertiser_count: 25
}
```

**GA4 Event Parameters**:
- `directory_advertiser_names_string` → Custom Dimension: "Directory Advertiser Names"
- `directory_advertiser_count` → Custom Dimension: "Directory Advertiser Count"

**GTM Variables Needed**:
- `DLV - Directory Advertiser Names String`
- `DLV - Directory Advertiser Count`
- `DLV - Directory Advertiser Names Array` (optional)

**GTM Trigger**:
- Event name: `directory_page_view`

