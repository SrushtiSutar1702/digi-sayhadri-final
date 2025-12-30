# Video Dashboard My Tasks Update Specification

## Objective
Update the Video Dashboard "My Tasks" section to match the Employee Dashboard "My Tasks" UI and functionality exactly.

## Current State (Video Dashboard)
- Basic table with columns: Checkbox, Task Name, Project, Due Date, Status, Revisions, Assigned To, Action
- Shows tasks grouped by client with purple headers
- Has status dropdown and basic action buttons
- Missing: Content, Reference Link, Special Notes, Start/Done dates, Revision Timeline, proper action buttons

## Target State (Employee Dashboard)
- Clean table with columns: Task Name, Content, Reference Link, Special Notes, Deadline, Start, Done, Revision Timeline, Status, Revisions, Actions
- Search functionality with search bar
- List View / Card View toggle buttons
- Download All Reports (PDF) button
- Client grouping with purple headers showing task counts
- Proper action buttons: "Start" (blue), "Complete" (green), status badges
- "View More" buttons for Content, Reference Link, and Special Notes

## Required Changes

### 1. Header Section
**Location:** After "My Tasks" title
**Add:**
```jsx
- Title: "My Tasks (X)" with count
- Subtitle: "Tasks assigned to you, organized by client. Select tasks to download report."
- Search bar with Search icon
- List View / Card View toggle buttons
- Download All Reports (PDF) button
```

### 2. Table Structure
**Current columns to REMOVE:**
- Project
- Assigned To (not needed in My Tasks - all assigned to current user)

**New columns to ADD:**
- Content (with "View More" button)
- Reference Link (with "View" link and "View More" button)
- Special Notes (with "View More" button)
- Start (date when task started)
- Done (date when task completed)
- Revision Timeline (shows "No timeline" or revision dates)

**Final column order:**
1. Task Name (with task icon)
2. Content (with "View More" button)
3. Reference Link (with "View" link + "View More" button)
4. Special Notes (with "View More" button)
5. Deadline
6. Start
7. Done
8. Revision Timeline
9. Status (badge: Pending/In Progress/Completed)
10. Revisions (green circle with count)
11. Actions (Start/Complete buttons)

### 3. Client Grouping Headers
**Keep current purple gradient headers but update format:**
```jsx
- Client name on left
- Task count: "X tasks • Y completed • Z in progress" on right
- Collapse/expand triangle icon
```

### 4. Action Buttons
**Replace current buttons with:**
- **Start button** (blue, shows when status is "pending" or "assigned")
  - Icon: Play circle
  - Text: "Start"
  - Action: Updates status to "in-progress", sets startDate
  
- **Complete button** (green, shows when status is "in-progress")
  - Icon: Check circle
  - Text: "Complete"
  - Action: Updates status to "completed", sets doneDate

- **Status badges** (show for completed/approved/posted)
  - Yellow badge for "Pending"
  - Blue badge for "In Progress"
  - Green badge for "Completed"

### 5. Search Functionality
**Add search that filters by:**
- Client name
- Task name
- Content
- Special notes

**Show search results info:**
- "Found X task(s) matching 'search term'"
- Clear button (×) to reset search

### 6. View Mode Toggle
**Add state:**
```javascript
const [viewMode, setViewMode] = useState('list'); // 'list' or 'card'
```

**List View:** Table format (default)
**Card View:** Card-based layout (similar to current card view but with all fields)

### 7. Download Functionality
**Add "Download All Reports (PDF)" button:**
- Downloads PDF report for all tasks in My Tasks
- Groups by client
- Includes all task details

## Files to Reference
- **Source:** `src/components/EmployeeDashboard.js` (lines 2330-3500 approximately)
- **Target:** `src/components/VideoDashboard.js` (lines 4423+ for My Tasks section)

## Key Code Sections to Copy/Adapt

### From EmployeeDashboard.js:
1. **Search bar component** (~line 2360)
2. **View toggle buttons** (~line 2395)
3. **Download All Reports button** (~line 2430)
4. **Table header structure** (~line 2500)
5. **Client grouping logic** (~line 2550)
6. **Task row rendering** (~line 2600)
7. **Action buttons (Start/Complete)** (~line 2700)
8. **View More modals** (~line 2800)

## Data Fields Required
Ensure tasks have these fields:
- `taskName`
- `content` or `description`
- `referenceLink`
- `specialNotes`
- `deadline`
- `startDate` (when task started)
- `doneDate` (when task completed)
- `revisionTimeline` (array of revision dates)
- `status`
- `revisionCount`
- `clientName`

## Styling Notes
- Use same purple gradient for client headers: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- Table rows: white background, hover effect
- Action buttons: 
  - Start: `#3b82f6` (blue)
  - Complete: `#10b981` (green)
- Status badges:
  - Pending: `#fbbf24` (yellow)
  - In Progress: `#3b82f6` (blue)
  - Completed: `#10b981` (green)

## Testing Checklist
- [ ] Search filters tasks correctly
- [ ] List/Card view toggle works
- [ ] Download All Reports generates PDF
- [ ] Start button updates status and sets startDate
- [ ] Complete button updates status and sets doneDate
- [ ] Client grouping shows correct task counts
- [ ] View More buttons show full content in modals
- [ ] Revision count displays correctly
- [ ] All columns show proper data
- [ ] Responsive design works on mobile

## Implementation Steps
1. Read EmployeeDashboard.js My Tasks section completely
2. Create new My Tasks component structure in VideoDashboard.js
3. Add search state and functionality
4. Add view mode toggle
5. Update table structure with all columns
6. Add Start/Complete action buttons
7. Add Download All Reports functionality
8. Test all features
9. Verify styling matches Employee Dashboard

## Notes
- Video Dashboard is for Video Head (manager role)
- Employee Dashboard is for Video Employees
- Both should have identical My Tasks UI
- Video Head's My Tasks shows tasks assigned to them (when they assign to themselves)
- Keep existing functionality for status updates, revisions, etc.

## Estimated Lines of Code
- Approximately 800-1200 lines need to be updated/replaced
- Main section: Lines 4423-5800 in VideoDashboard.js

---
**Created:** December 22, 2025
**Purpose:** Guide for updating Video Dashboard My Tasks to match Employee Dashboard
**Priority:** High
