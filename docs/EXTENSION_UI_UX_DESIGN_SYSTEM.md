# Srijon Docked Extension Design System

Reusable UI/UX direction for Adobe UXP and CEP extensions.

Version: 1.0
Primary theme: dark, compact, modern, calm, premium
Accent: `#0172FE`

---

## 1. Purpose

Use this document to design or overhaul any docked Adobe extension: captioning,
AutoCut, media organization, batch export, review, automation, metadata, or a
different production workflow.

This is a design system, not a fixed screen template. Preserve its visual
language and interaction standards, but derive the information architecture
from the new product's actual job. Do not turn every future tool into another
version of Srijon Captioner.

When giving this document to an AI model, also provide:

1. The complete extension folder.
2. The current behavior/feature contract.
3. The host and minimum version: UXP or CEP, Premiere version, and OS.
4. Screenshots of the current UI inside its real docked panel.
5. The smallest and normal panel sizes.

## 2. Non-negotiable product principles

1. **Preserve working behavior.** A visual overhaul must not silently change
   business logic, host integration, output data, timing, persistence, or file
   handling.
2. **Design for a dock, not a webpage.** Assume constrained width, variable
   height, frequent resizing, and use beside a timeline.
3. **One obvious next action.** The highest-value action in the current state
   must be visually unmistakable.
4. **Always explain state.** Ready, working, success, empty, disabled, and error
   states need visible text—not color alone.
5. **Make invalid actions safe.** Prevent duplicate jobs, destructive races,
   empty operations, and conflicting state changes. Explain how to recover.
6. **Progressive disclosure.** Keep the everyday workflow immediately visible;
   put infrequent or technical controls behind reliable disclosures.
7. **Premium means restrained.** Use hierarchy, spacing, typography, and exact
   states—not decorative gradients, excessive glass, or a pile of cards.
8. **Every control reacts.** A click must start work, change state, open a
   control, or explain why the action cannot run.

## 3. Design character

The interface should feel like a focused professional instrument:

- dark enough to sit comfortably inside Premiere Pro;
- clean and calm, with Apple-like clarity rather than a macOS imitation;
- compact without becoming cramped;
- precise, tactile, and visibly responsive;
- friendly to someone using it several times every day;
- quiet everywhere except the primary action and important status changes.

The memorable element is the decisive blue action/state. Everything around it
should be disciplined and low-noise.

### Avoid

- generic SaaS dashboards;
- identical rounded cards around every section;
- large website-style hero areas;
- neon gradients or decorative glow everywhere;
- all-caps eyebrow labels above every heading;
- unexplained icons;
- gray native buttons that the host can restyle unpredictably;
- tiny clipped button labels;
- status messages hidden at the bottom;
- horizontal scrolling at any supported dock width;
- motion added only to make the UI look “modern.”

## 4. Adapt the system to the product

Before drawing the interface, answer these questions:

- Who uses this extension?
- What task do they repeat most often?
- What information must be visible before that task starts?
- What can go wrong or take a long time?
- What result does the extension create?
- What should the user do immediately after success?

Then define:

- **Primary action:** one action that advances the main workflow.
- **Current context:** active sequence, selected clips, source bin, preset, or
  whatever the action operates on.
- **Live status:** the most recent meaningful system activity.
- **Core settings:** settings changed frequently.
- **Advanced settings:** technical or infrequent settings.
- **Result area:** preview, job list, analysis, summary, or output.
- **Delivery actions:** save, apply, export, import, copy, or open.

Example adaptations:

| Product | Current context | Primary action | Result area |
|---|---|---|---|
| AutoCut | selected sequence and silence profile | Analyze and cut sequence | proposed cuts and time saved |
| Batch exporter | selected sequences and destination | Start batch export | queue with progress and output paths |
| Media organizer | active project/bin and rule set | Organize selected media | proposed moves and rename preview |
| Caption tool | active sequence and transcript settings | Transcribe sequence | caption preview and exports |

The visual language remains consistent; the workflow structure follows the
product.

## 5. Color system

Use a small, functional palette. Color communicates hierarchy and state.

```css
:root {
  --canvas: #090a0d;
  --surface: #16181d;
  --surface-raised: #202329;
  --surface-control: #0f1115;

  --line: #2a2d34;
  --line-soft: #23262c;

  --text: #f5f7fa;
  --text-secondary: #9a9fa9;
  --text-tertiary: #6f7580;

  --accent: #0172FE;
  --accent-hover: #1680ff;
  --accent-pressed: #0062dd;
  --accent-soft: rgba(1, 114, 254, 0.12);

  --success: #31d17c;
  --warning: #ffb84d;
  --danger: #ff6b6b;

  --radius-group: 14px;
  --radius-control: 9px;
}
```

### Color rules

- `#0172FE` is reserved for the main action, selected high-value state, focus,
  and key informational emphasis.
- Do not make every active control blue. For ordinary selected states, use a
  raised neutral surface and white text.
- Success, warning, and danger colors are semantic only.
- Text must remain readable without relying on glow.
- Use borders one step lighter than their surface. Avoid bright outlines around
  every container.
- Use translucent accent backgrounds only for small notices or selected states.

## 6. Typography

Use host-safe system fonts. Do not require a web font or network connection.

```css
font-family: -apple-system, BlinkMacSystemFont,
  "Segoe UI Variable", "Segoe UI", Arial, sans-serif;
```

Recommended scale for a docked panel:

| Role | Size | Weight | Notes |
|---|---:|---:|---|
| Active context/title | `18–20px` | `620–650` | One per primary context block |
| Section heading | `15–16px` | `640–660` | Sentence case |
| Brand/product name | `13px` | `640–660` | Compact, never a large hero |
| Primary action | `11–12px` | `650–680` | Direct verb phrase |
| Body/control text | `10–12px` | `400–600` | Prefer clarity over density |
| Helper/status text | `8.5–10px` | `400–580` | Never essential if illegible |
| Code/timestamps | `8.5–10px` | `400–550` | Tabular numerals where useful |

Typography rules:

- Use sentence case.
- Use one font family; monospace only for code, paths, IDs, or timestamps.
- Keep helper text short and specific.
- Do not use letter spacing as decoration.
- Avoid lines longer than roughly 70 characters inside the panel.
- Use weight and contrast before increasing size.

## 7. Spacing and geometry

Build from a compact 4 px rhythm:

- micro gap: `2–4px`;
- control gap: `6–8px`;
- row padding: `8–12px`;
- group padding: `12–16px`;
- section separation: `20–24px`;
- panel edge padding: `11px` at narrow widths, `16px` normally.

Use two radius levels:

- groups/surfaces: `12–14px`;
- controls: `7–10px`;
- circular status indicators and icon wells only when their geometry has a
  functional reason.

Do not use the same radius and shadow on every element. A settings list may be
one grouped surface with divided rows; it does not need a card around each row.

Recommended shadows:

```css
/* Major interactive/context surface only */
box-shadow: 0 10px 30px rgba(0, 0, 0, 0.14);

/* Floating-looking activity/status strip */
box-shadow: 0 8px 18px rgba(0, 0, 0, 0.20);

/* Blue primary action */
box-shadow:
  inset 0 1px 0 rgba(255, 255, 255, 0.22),
  0 8px 24px rgba(1, 114, 254, 0.17);
```

Use shadows sparingly. Most hierarchy should come from surface color, spacing,
and borders.

## 8. Docked-panel layout

Design for these widths:

- minimum: `300px`;
- common narrow dock: `360–430px`;
- comfortable dock: `430–600px`;
- wide/floating: up to about `760px` before content is capped.

The default structure is a single vertical workflow:

```text
┌─────────────────────────────────────┐
│ Brand                 System health │
├─────────────────────────────────────┤
│ Live activity / error / success     │
├─────────────────────────────────────┤
│ Current context                     │
│ [ Primary action                  ] │
│ [ Secondary source/action         ] │
│ ▸ Technical setup                   │
├─────────────────────────────────────┤
│ Optional mode switch                │
├─────────────────────────────────────┤
│ Core settings                       │
│ grouped rows / segmented controls   │
├─────────────────────────────────────┤
│ Result / preview / queue             │
├─────────────────────────────────────┤
│ Delivery actions                    │
└─────────────────────────────────────┘
```

This is a hierarchy reference, not a mandatory component order. For example, a
batch exporter may place its queue before settings once work starts.

### Scrolling contract

The extension must scroll inside an explicit viewport:

```css
html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

.app {
  width: 100%;
  height: 100%;
  max-width: 760px;
  margin: 0 auto;
  overflow-x: hidden;
  overflow-y: scroll;
}
```

Never depend on the host to make `body` scroll correctly. Verify wheel, trackpad,
scrollbar, and keyboard behavior inside the real extension.

### Narrow-width behavior

At `420px` and below:

- reduce panel edge padding;
- hide only nonessential secondary copy;
- allow helper text and action labels to wrap;
- stack metric fields if they no longer fit;
- reduce segmented-control minimum widths;
- preserve the full primary action label;
- never introduce horizontal scrolling.

## 9. Component language

### Brand header

- Compact mark, product name, and one-line description.
- A health/status control may sit opposite it.
- The header is not a marketing hero.
- If width is limited, remove secondary text before truncating the product name.

### Live activity strip

Place it near the top, before the workflow. It answers: “What is happening?”

Required states:

| State | Dot | Label | Message example |
|---|---|---|---|
| Ready | blue | Activity | Ready to analyze the active sequence. |
| Working | blue | Working | Analyzing 14 selected clips… |
| Success | green | Complete | Cut plan created. Review 27 proposed edits. |
| Error | red | Needs attention | No sequence is active. Open one and try again. |

Use `aria-live="polite"` and `aria-atomic="true"`. Preserve multiline paths or
recovery instructions with `white-space: pre-wrap`.

### Current-context block

Show what the next action will operate on: current sequence, selection count,
active bin, output location, or preset. Include a refresh action if host state
can change outside the panel.

### Primary action

- Use the blue accent.
- Begin with a concrete verb: “Analyze sequence,” “Organize selected media,” or
  “Start batch export.”
- Add one short helper line when the operation has multiple meaningful stages.
- Do not label it “Go,” “Run,” “Submit,” or “Process” without context.
- During a long job, show a busy state but retain a meaningful response if the
  user tries to start another job.

### Secondary actions

Use a neutral raised surface. Secondary actions must not compete with the main
blue action. Destructive actions should normally be quiet text that becomes red
on focus/hover, not a permanently bright red button.

### Settings groups

- Prefer one bordered group with divided rows.
- Align labels left and controls right at comfortable widths.
- Put units inside the control shell (`sec`, `frames`, `%`) rather than in a
  separate distant label.
- Use helper text only when it prevents a likely mistake.

### Segmented controls

Use for two to four mutually exclusive choices. The selected neutral state is a
raised surface; reserve a blue selected segment for a decision with strong
workflow significance.

Every segment needs:

- `role="button"` or a reliable native equivalent;
- keyboard activation;
- `aria-pressed`;
- a visible focus ring;
- a complete, non-clipped label.

### Switches

Use switches for immediate boolean settings, not actions. The label explains
the setting; the smaller line explains its effect.

### Disclosures

Disclosures hide infrequent settings, not required steps. The entire trigger row
is clickable. Always expose `aria-expanded` and update the glyph.

For the conservative UXP baseline, use an explicit trigger and content region
instead of relying on native `<details>/<summary>` behavior.

### Preview, result, or queue

- Empty state: explain what will appear and how to create it.
- Loading state: keep the last reliable context visible where safe.
- Result rows: use dividers instead of individual cards.
- Large data: cap the preview height and scroll internally.
- Never imply that a preview is the complete export if it is truncated.

### Delivery actions

Group the final actions together. Make the recommended path blue and slightly
wider. Name the outcome precisely: “Apply cuts,” “Auto-save + Import,” “Export
queue,” or “Copy report.”

## 10. Interaction and job-state model

Long-running production tools need explicit state management.

```text
idle
  ├─ preflight failed ───────────────> idle + actionable error
  ├─ cancelled before start ─────────> idle + cancellation message
  └─ accepted ─> preparing ─> working ─> cleanup ─> success
                                  └───> cleanup ─> error
```

Minimum guardrails:

- Only one destructive or resource-heavy job runs at a time.
- A duplicate attempt is rejected immediately; never silently queue hours of
  work unless the product visibly implements a queue.
- Validate prerequisites before expensive work.
- Snapshot job settings at start.
- Freeze native fields that would make the active job ambiguous.
- Keep harmless navigation/disclosures usable.
- Block clearing, replacing, rebuilding, or exporting data that an active job
  is mutating.
- Restore controls in `finally`/equivalent cleanup paths.
- Preserve the last successful result if a new job fails, unless the product
  contract requires otherwise.
- Notification failure must never invalidate successful work.

For service-backed extensions, enforce exclusivity both in the panel and in the
service. A panel-only boolean is lost when the panel reloads.

### Long-job completion

For tasks that can take minutes or hours:

- tell users whether they may switch apps;
- state what must remain open;
- optionally provide a completion sound or OS notification;
- make completion alerts configurable;
- fire alerts only on genuine success;
- include the next action in the success message.

## 11. Writing and interface copy

Use plain, direct language.

### Action formula

`Verb + object [+ scope]`

- Good: `Analyze current sequence`
- Good: `Apply cuts to selected clips`
- Good: `Open output folder`
- Weak: `Run`
- Weak: `Submit`

### Error formula

`What could not happen + why + what to do next`

- `Cannot rebuild yet: no analysis exists. Analyze the sequence first.`
- `Another export job is running. Wait for it to finish, then try again.`
- `No clips are selected. Select at least one timeline clip.`

Do not use vague messages such as `Something went wrong`, `Invalid operation`,
or `Error 12` without a human explanation.

### Success formula

`What completed + useful quantity/location + next action`

- `Analysis complete. Review 27 proposed cuts.`
- `Exported 8 sequences to D:\Client\Deliveries.`

Keep vocabulary consistent: if the action is “Apply cuts,” the success state
says “Cuts applied,” not “Operation completed.”

## 12. Accessibility and input behavior

- Provide a visible `2px` accent focus ring.
- Support Enter and Space for custom action surfaces.
- Use `aria-disabled`, `aria-busy`, `aria-pressed`, and `aria-expanded` accurately.
- Do not encode status only with color.
- Keep essential controls at least `30px` high; primary actions should usually be
  `44–64px` high.
- Give icon-only actions an `aria-label` and tooltip/title.
- Preserve readable contrast for secondary text.
- Do not mutate focused number inputs when the user is trying to scroll the
  panel; prevent the wheel step or forward the scroll to the panel viewport.
- Respect reduced motion. The conservative shared theme works without animation.

## 13. UXP and CEP implementation rules

### Shared baseline

For maximum portability between UXP and CEP:

- use Flexbox for primary layout;
- use local/system fonts;
- use inline SVG icons with `currentColor`;
- use class/attribute-driven state;
- keep the DOM simple and inspectable;
- avoid remote assets for core UI;
- verify at 300, 390, 430, 570, and 760 px widths;
- verify inside the host, not only in a normal browser.

### UXP cautions

UXP is browser-like, not a complete browser. Host rendering can differ from
Chrome.

- Prefer explicit disclosure logic over `<details>/<summary>`.
- Prefer an explicit inner scroll viewport over body scrolling.
- Avoid depending on `position: sticky`.
- Avoid complex or decorative motion; test every CSS feature in the target host.
- Native `<button>` styling may be overridden by Premiere. A custom action
  surface may be more reliable when implemented accessibly.
- Do not assume a changed source file is what Premiere loaded. Rebuild the CCX,
  bump the version, reinstall, close/reopen Premiere, and inspect the packaged
  artifact.

Accessible custom-action baseline:

```html
<div class="uiButton primaryAction"
     role="button"
     tabindex="0"
     aria-disabled="false">
  Analyze current sequence
</div>
```

```js
function setControlDisabled(control, disabled) {
  control.setAttribute("aria-disabled", disabled ? "true" : "false");
  control.setAttribute("tabindex", disabled ? "-1" : "0");
}

function wireAction(control, handler) {
  control.addEventListener("click", event => {
    if (control.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    handler(event);
  });

  control.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (control.getAttribute("aria-disabled") !== "true") control.click();
  });
}
```

### CEP cautions

CEP embeds Chromium, but the available version varies with the Adobe host.

- Check the Chromium version before using new CSS or JavaScript features.
- Keep a transpilation/build target appropriate for the oldest supported host.
- Separate UI code from ExtendScript/host bridges.
- Treat host calls as fallible and show progress while awaiting callbacks.
- Test reload, persistence, panel resizing, and theme behavior in the actual CEP
  panel.
- Do not let broader browser support tempt the design into a full-screen website
  layout.

## 14. CSS foundation

This is a starting foundation, not a complete component library:

```css
* { box-sizing: border-box; }

html,
body {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  margin: 0;
  overflow: hidden;
  background: var(--canvas);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont,
    "Segoe UI Variable", "Segoe UI", Arial, sans-serif;
  font-size: 12px;
  line-height: 1.4;
}

.app {
  width: 100%;
  height: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 16px 16px 28px;
  overflow-x: hidden;
  overflow-y: scroll;
}

.uiButton {
  min-width: 0;
  cursor: pointer;
  user-select: none;
}

.uiButton:focus {
  outline: 2px solid rgba(1, 114, 254, 0.9);
  outline-offset: 2px;
}

.uiButton[aria-disabled="true"] {
  cursor: default;
  opacity: 0.36;
}

.primaryAction {
  display: flex;
  width: 100%;
  min-height: 56px;
  align-items: center;
  padding: 12px 13px;
  border: 1px solid #2487ff;
  border-radius: 12px;
  background: var(--accent);
  color: #fff;
  font-weight: 660;
}

.settingsGroup {
  overflow: hidden;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-group);
  background: var(--surface);
}

.settingRow {
  display: flex;
  min-height: 43px;
  align-items: center;
  justify-content: space-between;
  padding: 7px 11px;
}

.settingRow + .settingRow {
  border-top: 1px solid var(--line-soft);
}

@media (max-width: 420px) {
  .app { padding: 12px 11px 24px; }
  .optionalDetail { display: none; }
  .responsiveRow { flex-wrap: wrap; }
}
```

## 15. AI overhaul protocol

An AI model using this design system should follow this order:

### Phase 1: protect behavior

1. Read the project handoff, feature contract, architecture, manifest, UI source,
   and host-integration code.
2. Inventory every visible control, DOM ID, event binding, storage key, host call,
   output, and error path.
3. Write a preservation checklist before editing.
4. Identify which files are actually packaged and installed.

### Phase 2: design from the workflow

1. Identify the primary repeated task and current context.
2. Sketch the hierarchy for 300–430 px dock widths first.
3. Map every existing feature into the new hierarchy.
4. Separate everyday settings from advanced settings.
5. Define empty, working, success, error, and busy-conflict states.

### Phase 3: build

1. Implement the semantic structure before visual polish.
2. Apply the shared tokens and component language.
3. Preserve or deliberately remap every required DOM hook.
4. Add keyboard and ARIA behavior for custom controls.
5. Add guardrails around asynchronous/destructive operations.

### Phase 4: verify in proportion to risk

1. Test every button and setting in success, empty, busy, cancel, and failure
   states.
2. Test scrolling and zero horizontal overflow at target widths.
3. Verify long labels are fully visible.
4. Verify keyboard focus and activation.
5. Compare the packaged artifact with source.
6. Bump the extension version and reinstall cleanly.
7. Close/reopen the Adobe host and test the installed build.
8. Re-run the original feature contract, especially high-risk host operations.

## 16. Acceptance checklist

### Visual

- [ ] Dark theme uses the documented palette.
- [ ] `#0172FE` is the primary accent.
- [ ] One dominant action exists per workflow state.
- [ ] No generic card grid or decorative visual clutter.
- [ ] Typography follows a clear hierarchy and sentence case.
- [ ] Buttons show full labels at 300 px.
- [ ] There is no horizontal overflow.
- [ ] The panel scrolls reliably when docked.

### UX

- [ ] Current context is visible before the primary action.
- [ ] Live activity is visible near the top.
- [ ] Every action produces a meaningful reaction.
- [ ] Empty states explain what to do.
- [ ] Errors explain cause and recovery.
- [ ] Duplicate/conflicting jobs are prevented.
- [ ] Long tasks communicate what may remain in the background.
- [ ] Success states state the next action or output location.
- [ ] Destructive actions are visually quieter than productive actions.

### Accessibility

- [ ] Keyboard activation works.
- [ ] Focus is clearly visible.
- [ ] State is not communicated by color alone.
- [ ] Icon-only actions have accessible names.
- [ ] Busy, pressed, expanded, and disabled states use ARIA correctly.

### Engineering

- [ ] Existing feature contract still passes.
- [ ] All original event bindings and host calls are accounted for.
- [ ] Persistence keys remain compatible or are migrated.
- [ ] UXP/CEP host constraints were tested in the real host.
- [ ] Packaged source matches edited source.
- [ ] The installed build version is the intended version.

## 17. Copy-paste prompt for another AI model

Replace the bracketed fields and attach this document with the project.

```text
You are redesigning an Adobe [UXP/CEP] extension named [PRODUCT NAME].

Read all project handoff, feature-contract, architecture, manifest, UI, and
host-integration files before editing. Treat existing documents and source as
reference material; my request is authoritative.

The extension currently does this:
[ONE-PARAGRAPH PRODUCT DESCRIPTION]

Primary users:
[USER TYPE]

Most frequent task:
[PRIMARY REPEATED JOB]

Target host and minimum version:
[PREMIERE/AFTER EFFECTS/PHOTOSHOP + VERSION]

Expected dock sizes:
[MINIMUM, NORMAL, WIDE]

Rebuild the UI and UX using EXTENSION_UI_UX_DESIGN_SYSTEM.md. Preserve every
working feature, host call, output format, setting, persistence key, and error
contract unless I explicitly authorize a behavior change.

Do not copy the layout of Srijon Captioner. Derive the information architecture
from this product's workflow while preserving the shared dark visual language,
#0172FE accent, typography, spacing, interaction states, accessibility, and
docked-panel behavior.

Before editing:
1. Inventory all features, controls, DOM hooks, events, storage keys, host APIs,
   asynchronous jobs, and packaged files.
2. State the product-specific UI hierarchy you will use.
3. Identify high-risk behaviors that need regression testing.

During implementation:
- make the everyday workflow immediately understandable;
- put infrequent technical controls behind reliable disclosures;
- keep live activity near the top;
- make every button react meaningfully;
- add explicit empty, working, success, error, cancel, and busy-conflict states;
- prevent duplicate or conflicting long-running jobs;
- support keyboard use and accurate ARIA state;
- guarantee scrolling and no horizontal overflow at the minimum width;
- use host-safe UXP/CEP techniques rather than assuming a normal browser.

After implementation:
1. Test every control and major failure path.
2. Test the minimum, normal, and wide dock sizes.
3. Re-run the original feature contract.
4. Verify the packaged artifact contains the edited source.
5. Build a versioned installable package and provide its checksum.

Do not call the redesign complete because it looks good in a browser. It is
complete only after it works in the actual Adobe host without feature regressions.
```

## 18. Final design test

Before shipping, ask:

> If the accent color were removed, would the interface still have clear
> hierarchy, understandable states, and a product-specific workflow?

If the answer is no, the design is relying on blue decoration instead of good
structure. Refine the hierarchy before shipping.
