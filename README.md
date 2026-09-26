# Roam Outreach — WhatsApp sales console

An internal tool for reaching out to Airbnb hosts, villa owners, boutique hotels and
vacation-rental managers about **Roam**, our digital guest experience platform.

**Number → template → personalize → OPEN WHATSAPP → press Send.**

The tool writes the message and opens the chat. You still press Send in WhatsApp yourself.

## Running it

It has no build step and no dependencies. You can:

- **Open `index.html`** in Chrome, Edge, Safari or Firefox (double-click it), or
- **Serve it locally** with `npm start` and go to http://localhost:5173, or
- **Host it** on any static host (GitHub Pages, Netlify, Vercel, S3). Nothing runs on a server.

## Database (Supabase)

When you sign in, templates, contacts, history, follow-ups and settings are saved to Supabase
(project `dvfkktqonymradyybjqv`). The same data then shows up on any computer or phone where you sign in.

- **Tables:** `wa_templates`, `wa_contacts`, `wa_outreach` and `wa_settings`. The schema is in
  `supabase/migrations/`.
- **Access:** row-level security means a signed-in user can only read and change their own rows.
  Signed-out visitors can't read anything.
- **Config:** the project URL and publishable key are in `config.js`. The publishable key is meant
  to be public. Set `supabaseUrl` to `''` to turn the database off.
- **First sign-in:** anything you already saved in that browser without an account is uploaded to
  the new account.
- **How saving works:** changes are kept in the browser first and saved to the database in the
  background. The dot at the top right shows *Saved*, *Saving…* or *Not saved — retrying*.
  When you come back to the tab, it reloads anything you changed on another device.
- **Using it without an account:** click **Use without an account** on the sign-in screen.
  Data then stays in that browser only.

**Creating your account:** use **Create an account** on the sign-in screen. By default Supabase
emails a confirmation link first. Supabase's built-in email service only delivers to members of
the project's team, so sign up with the project owner's address, or turn off **Confirm email**
under Authentication → Sign In / Providers → Email in the Supabase dashboard. If the link lands
on a page that doesn't load, the confirmation still went through, so go back to the app and sign in.
To stop other people creating accounts, turn off **Allow new users to sign up** in the same place
once your account exists.

**Where it works:** the database needs the page to be able to reach `*.supabase.co`. That works
when you open `index.html` locally or host it on your own site. It doesn't work inside a claude.ai
artifact, which blocks outside connections. There the app says so and runs without an account.

## Screens

| Screen | What it's for |
| --- | --- |
| **Quick Send** | The main screen. Type a number, pick a template, fill in the highlighted fields, then click **OPEN WHATSAPP →** (or press ⌘/Ctrl + Enter). Afterwards: **Mark as Sent**, then schedule a follow-up (3 / 5 / 7 days or a date), then **Next lead**. |
| **Follow-ups** | Leads that are overdue, due today or coming up. **Load →** fills Quick Send with the contact, the follow-up template and the preview. Sending it completes the follow-up. |
| **History** | Every chat you opened, with the message and its status. **Opened** means the chat was opened. **Sent** means you confirmed you pressed Send. |
| **Contacts** | Every number you've messaged is saved here automatically. You can add or edit details, import a CSV of your lead database, and export to CSV. |
| **Templates** | Create, edit, duplicate, delete and turn templates on or off. Variables are detected automatically. |
| **Settings** | Default country code, how chats open (WhatsApp Web, desktop app or wa.me), and backup/restore. |

### Keyboard shortcuts (Quick Send)

- **⌘/Ctrl + Enter**: open WhatsApp
- **Alt + S**: mark as sent
- **Alt + N**: clear the form for the next lead

## Templates and variables

Put `{{variable}}` anywhere in a template:

- `{{property_name}}`, `{{city}}` (shown as **Location**), `{{first_name}}`, `{{property_type}}`, `{{country}}` are filled from the contact.
- The built-in templates only use `{{property_name}}` and `{{city}}`, so a lead needs just a property name, a number and a location.
- Any other name, like `{{amenity}}`, becomes a text field in Quick Send and is saved with the contact.

Values you've filled are highlighted in the preview. Missing ones show in red, and the button
stays disabled until they're filled. Use **Edit message** to make a one-off change to the final text.

The tool ships with seven Roam templates: Property Introduction, Short Introduction,
Luxury Villa, Boutique Hotel, Vacation Rental, Follow-up and Demo Follow-up.
When the property name or type mentions "villa", "hotel", etc., Quick Send suggests the matching template.

## Phone numbers

Numbers are converted to international digits for WhatsApp click-to-chat:

- `+57 300 123 4567` or `0057 300 123 4567` → `573001234567`
- `300 123 4567` → `573001234567` if the default country code is set to 57 in Settings.
  If no default is set, you'll be asked to include the country code.
- A leading trunk `0` is dropped when the default country code is added (`07700 900123` with 44 → `447700900123`).

If a number you type already belongs to a contact, Quick Send shows it (and when you last
contacted them) and can fill in their details.

## How chats open

| Setting | URL used | Best for |
| --- | --- | --- |
| Automatic (default) | WhatsApp Web on computers, `wa.me` on phones | Most people |
| WhatsApp Web | `web.whatsapp.com/send?phone=…&text=…`, reusing a single tab | Desktop, fastest |
| WhatsApp desktop app | `whatsapp://send?phone=…&text=…` | The installed desktop app |
| wa.me link | `wa.me/<number>?text=…` | Phones (shows a "Continue to chat" page on desktop) |

If the browser blocks the popup, a notice appears with a direct link. Allow popups for the page once.

## CSV import

Contacts → **Import CSV**. The first row must be headers. Recognized columns (case-insensitive):
`name`, `property` / `property name`, `phone` / `whatsapp`, `country`, `city`,
`property type` / `type`, `website`, `instagram`, `email`, `notes`.
Rows without a valid number are skipped. Existing contacts (matched by number) only have
their empty fields filled in.

## Development

```
npm test   # unit tests for phone normalization, templates, CSV and dates (Node 18+)
```

- `lib.js`: pure logic, unit tested in `test/`
- `app.js`: UI, state and storage
- `cloud.js`: Supabase sign-in and sync; `config.js` holds the project URL and key
- `styles.css`: styles (light and dark)
