# ServiceNow Group Join Automator — Chrome Extension

Automates the "Lab - Modify Active Directory Group Membership" request on ServiceNow.
Upload a JSON file, use a saved payload, or pick a template — the extension fills the form fields in your configured order, clicks Next, and waits for your confirmation before submitting.

## Installation

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select the `servicenow-group-join-extension/` folder.
4. The extension icon appears in the toolbar.

## Configuration (Options Page)

Right-click the extension icon → **Options** (or go to `chrome://extensions` → Details → Extension options).

### ServiceNow Domain

Enter your ServiceNow portal domain (e.g. `mycompany.service-now.com`). The extension checks the active tab URL against this before running.

### Form Field Configuration

This is the core of the extension. Each field on the ServiceNow form is represented as an entry with:

| Property       | Description                                                                                   |
|----------------|-----------------------------------------------------------------------------------------------|
| **Key**        | Maps to a property in the JSON payload (`groupName`, `action`, `members`, `businessJustification`) |
| **Display Name** | Human-readable name shown in logs                                                          |
| **Label Match** | Comma-separated text fragments to match against visible labels on the SN page               |
| **Field Type** | `typeahead` (type + pick from dropdown), `text` (plain input), or `choice` (native select)   |
| **AJAX Wait**  | Milliseconds to wait after typing before looking for dropdown suggestions                     |
| **Enabled**    | Toggle to skip a field without deleting it                                                    |

Fields are filled **in the exact order shown** in the list. Use the arrow buttons to reorder.

#### Import / Export

You can export the field configuration as a JSON file to share with teammates, or import one. This makes it easy to standardize configs across a team.

### Active Payload

A quick-access payload you can run directly from the popup without uploading a file. Fill in Group Name, Action, Members (one per line), and Business Justification.

### Saved Templates

Save the active payload as a named template. Templates persist until you delete them. Useful for recurring requests (e.g. "Onboard new team member to falcon-ca").

## JSON Input Format

Create a `.json` file with this structure:

```json
{
  "members": ["user1@company.com", "user2@company.com"],
  "groupName": "falcon-ca",
  "action": "add",
  "businessJustification": "Raising ad group request"
}
```

| Field                   | Type       | Required | Description                                         |
|-------------------------|------------|----------|-----------------------------------------------------|
| `members`               | `string[]` | Yes      | One or more email addresses / user IDs               |
| `groupName`             | `string`   | Yes      | Target Active Directory group name                   |
| `action`                | `string`   | Yes      | `"add"` or `"delete"`                                |
| `businessJustification` | `string`   | Yes      | Reason for the request                               |

A sample file is included at `sample-input.json`.

## Usage

1. Open the ServiceNow request page in your browser.
2. Click the extension icon.
3. Choose an input mode:
   - **Upload JSON** — select a `.json` file
   - **Active Payload** — uses the payload saved in Options
   - **Template** — pick a saved template from the dropdown
4. Click **Run Automation**.
5. The extension fills fields in the configured order and clicks **Next**.
6. A confirmation dialog appears — click **Submit** to finalize, or **Cancel** to stop.

## How Field Matching Works

For each configured field, the extension:

1. Scans all visible labels/text on the page for any of the **Label Match** fragments.
2. From the matching label, walks the DOM to find the nearest interactable input element.
3. Keeps track of which elements have already been used, so no two fields target the same input.
4. Fills the value using the handler for the configured **Field Type**.

If a field can't be found, the extension stops with a detailed error showing the label match text and field type — so you know exactly what to fix in Options.

## Adjusting Label Matches

If a field isn't being found correctly:

1. Open the ServiceNow page and inspect the text near the field (use browser DevTools, F12).
2. Copy a unique fragment of the label text.
3. Go to Options → Field Configuration → update the **Label Match** for that field.
4. Save and retry.

Use short, unique fragments. For example, `"business justification"` is better than the full sentence.

## Adjusting AJAX Wait

ServiceNow typeahead fields make AJAX calls to fetch suggestions. If the dropdown doesn't appear in time:

1. Go to Options → Field Configuration.
2. Increase the **AJAX Wait** for the slow field (e.g. Members is typically slow — try 10000ms).
3. Save and retry.

## Status Log

The popup shows a real-time status log:
- Blue — in progress
- Green — success
- Red — error
- Yellow — awaiting confirmation

## Project Structure

```
servicenow-group-join-extension/
├── manifest.json            # Chrome MV3 manifest
├── sample-input.json        # Example input file
├── README.md
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── src/
    ├── storage-defaults.js  # Shared storage schema, keys, defaults, migration
    ├── background.js        # Service worker — loads field configs, routes messages
    ├── content-script.js    # Injected into SN page — config-driven field filling
    ├── selectors.js         # Label-based DOM field finder
    ├── schema.js            # JSON input validation
    ├── popup.html           # Extension popup UI
    ├── popup.js             # Popup logic with 3 input modes
    ├── popup.css            # Popup styles
    ├── options.html         # Full settings page
    ├── options.js           # Options logic (field editor, payloads, templates)
    └── options.css          # Options styles
```

## Upcoming Features

See [docs/upcomingFeatures.md](docs/upcomingFeatures.md) for planned features and detailed design documents.

## Troubleshooting

- **"No active tab found"** — Make sure the ServiceNow page is the focused tab.
- **"Active tab does not match configured domain"** — Check the domain in Options.
- **"Could not find field: ..."** — The label match text doesn't match any label on the page. Update it in Options.
- **Dropdown not matching** — Increase AJAX Wait in Options. Check the browser console (F12) for `[SN Group Join]` logs.
- **Field targeting wrong input** — Reorder fields in Options so the correct one is processed first. The extension tracks used elements to prevent duplicates.
