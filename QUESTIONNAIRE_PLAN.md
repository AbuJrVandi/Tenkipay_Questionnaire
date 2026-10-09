# Questionnaire management plan

## Objective

Give TenkiPay staff a clear workflow to create questionnaires, edit and add questions, configure collection, publish and share forms, review responses, and understand results. Preserve existing responses and the current agent questionnaire throughout the upgrade.

This is an implementation plan, not a completed feature or a guarantee of zero defects. Release readiness depends on the acceptance checks below.

## Product benchmark and agreed structure

Use Google Forms as the reference for approachable question cards and section organisation, and KoboToolbox as the reference for structured survey definitions, skip logic, and validation. KoboCollect is the field collection application; the questionnaire-building reference is KoboToolbox's Formbuilder. This is a custom TenkiPay implementation; integration or compatibility with those products is a separate scope.

Official references:

- [Google Forms: edit a form](https://support.google.com/docs/answer/2839737?hl=en).
- [Google Forms: section branching](https://support.google.com/docs/answer/141062?hl=en). Google documents answer-based section routing for multiple-choice and dropdown questions.
- [KoboToolbox: getting started with the Formbuilder](https://support.kobotoolbox.org/formbuilder.html).
- [KoboToolbox: form logic](https://support.kobotoolbox.org/form_logic.html).
- [KoboToolbox: skip logic](https://support.kobotoolbox.org/skip_logic.html).

### Creation workflow

1. Select **New questionnaire** and choose Blank, TenkiPay template, or Duplicate existing.
2. Set its name, purpose, introduction, and language. Start in Draft.
3. Create sections with titles and descriptions, then add question cards within them.
4. Choose each question's type, write its label, add choices and guidance, and configure Required.
5. Open advanced question settings only when needed: validation, display conditions, and internal data name.
6. Configure participation, location permissions, collection schedule, and completion message.
7. Preview the draft and test every route. Show unresolved errors beside the affected questions.
8. Publish a validated version, then copy its public link or download its QR code.
9. Monitor submissions, review individual answers, and explore filtered statistics.

### Builder interaction specification

The header shows the questionnaire name, Draft/Live state, save feedback, Preview, and Publish. Keep the section outline collapsible and the selected question visually distinct. A compact toolbar offers Add question, Add section, and Add information text. Question cards expose the label, type selector, option rows, help text, Required switch, Duplicate, and Delete. Advanced settings use labelled tabs for Properties, Logic, and Validation.

Keep ordinary creation understandable without technical expressions. For example, a logic rule reads **Show this question when → Interested in becoming an agent → equals → Yes**. Allow All/Any condition groups and show the resulting sentence. Hidden required questions must not block submission. Section routing and question visibility must use a single coherent rule model; validate that every path reaches completion and prevent contradictory routes.

Treat type changes explicitly: preserve compatible settings, show incompatible settings that will be removed, and require review before publishing. Undo draft deletions. Block deletion of a referenced question until its dependencies are resolved. Reordering must revalidate any rules that depend on earlier answers.

### Professional survey structure

| Layer | Content | Rule |
| --- | --- | --- |
| Questionnaire | Name, description, language, lifecycle, collection settings | Stable identity across published versions |
| Section | Title, guidance, ordered questions, display/routing rules | Organises the respondent journey |
| Question | Stable ID, data name, label, type, hint, required rule, validation | Visible wording is separate from stored identity |
| Choice | Stable ID, export code, displayed label | Renaming a label does not change historical meaning |
| Logic | Referenced question/choice IDs, operators, conditions, action | Validated on save and before publication |
| Published version | Complete immutable questionnaire definition | Every response records its version |
| Response | Answers, timestamps, version, collection source | Historical interpretation remains reproducible |

For the TenkiPay template, retain a clear order: Participation and location; Applicant and business; Experience and customers; Operational readiness; Support and timeframe; Contact permission and details. Other questionnaires can define their own sections. Identify reused fields through explicit semantic mappings so TenkiPay-specific analytics do not assume every new questionnaire contains the same questions.

### Scope boundaries and future capabilities

The initial target is a complete online builder and web respondent experience. Multilingual labels, reusable question libraries, cascading choices, repeat groups, calculations, attachments, XLSForm import/export, and offline field collection are later capabilities with separate implementation and acceptance checks. KoboCollect-level offline collection requires local storage, sync/retry handling, device/session management, and conflict policies; a mobile-friendly web form alone does not provide it.

The professional completion standard is that a staff member can create a questionnaire from blank, configure its questions and rules, preview, publish, share, and reconcile responses with analytics without editing source code.

## Current project

- `src/Admin.jsx` provides wording and help-text editing, collection controls, sharing, response review, and analytics.
- `server/app.js` requires the existing question count and preserves question structure when saving. Adding a question needs API changes as well as editor changes.
- `shared/questionnaire.js` defines fixed sections and ID-specific visibility rules. General question creation requires schema-driven sections, validation, and conditional logic.
- `server/schema.sql` stores questionnaire versions and ties submissions to those versions. Its current model serves one questionnaire and needs expansion for multiple questionnaires.
- `server/analytics.js` includes general choice counts alongside TenkiPay-specific measures. General analytics must use the appropriate historical definitions and explicit denominators.
- The public form currently rejects submission after a version change. Publishing needs an explicit policy for people already completing a form.

## 1. Workspace and visual design

Start with a questionnaire list showing title, status, response count, last update, and actions to open or duplicate. Inside each questionnaire use consistent navigation: Overview, Builder, Settings, Share, Responses, Analytics.

Use the existing TenkiPay identity, neutral backgrounds, restrained accent colours, readable typography, consistent spacing, and accessible contrast. Keep one primary action per view. Show clear loading, empty, success, permission, conflict, and failure states. Support keyboard use, visible focus, descriptive labels, and mobile layouts.

The builder has a section/question outline on the left, editable question cards in the centre, and properties on the right. On smaller screens, use a single column and a properties panel. Reordering must support buttons and keyboard controls as well as drag and drop.

## 2. Create and edit

Create from a blank questionnaire, the existing TenkiPay template, or a duplicate. Support short text, long text, single choice, multiple choice, dropdown, number, email, phone, date, and time. Keep GPS and Adrehs as dedicated components with explicit permission and location settings.

Each question has a stable internal ID, label, help text, type, required setting, validation, and optional display conditions. Choice options have stable IDs separate from their displayed labels. Numbering follows the displayed order automatically.

Allow adding, duplicating, reordering, and removing draft questions; editing options; configuring Other and exclusive choices; and adding, renaming, and reordering sections. Warn about referenced questions before removal. Published versions remain immutable.

Start conditional logic with “show when” rules against earlier questions. Prevent missing references, circular dependencies, incompatible comparisons, and invalid option references. Provide a plain-language rule summary. Preserve the existing participation, interest, contact-permission, and location behaviour in the TenkiPay template.

## 3. Draft, preview, and publish

Use Draft, Live, Paused, Closed, and Archived states. A live questionnaire can also have unpublished draft changes. Saving a draft never changes the respondent form.

Autosave after a short idle period and show Saving, Saved, or Save failed. Retain unsaved edits on failure. Use revision checks to prevent one editor silently overwriting another.

Preview the exact draft on desktop and mobile. Preview must not create real responses, analytics events, or external Adrehs registrations. Include a branching walkthrough and a summary of validation problems.

Publishing displays a change summary, validates the entire definition, and creates an immutable published version in a database transaction. Record who published and when. Restore an earlier definition into a new draft rather than rewriting history.

Pin an active respondent session to its starting published version. Allow submission of that version for a defined grace period while collection remains open. Pausing or closing collection blocks all new submissions; explain expired sessions without silently discarding answers. Keep repeated submission requests idempotent.

## 4. Collection settings and sharing

Configure title, introduction, participation notice, completion message, opening/closing times, response limit, and location policy. Store schedule times in UTC and display the selected timezone clearly, defaulting to Africa/Freetown.

Provide a stable public HTTPS link, copy-link feedback, downloadable QR code, and an Open live form action. Show collection status alongside the link. Before first publication, check required fields, valid logic, permissions, the public URL, and preview results.

Add optional source links for channels such as WhatsApp, field teams, and posters. Keep campaign identifiers separate from personal data. Describe repeat-response restrictions accurately: browser checks alone cannot guarantee one response per person.

## 5. Responses and monitoring

Provide a searchable, paginated response table with date, version, district, source, and review-status filters. Show individual answers using the wording and options from their submitted version.

Keep submitted answers immutable by default. Store staff notes and review decisions separately, with actor and timestamp. Reuse the same filters for the table, charts, and exports. Export historical definitions or a version-aware data dictionary so renamed and removed questions remain understandable.

Show last refresh time and an explicit refresh action. Add controlled polling while the dashboard is visible; pause it when hidden. Show API failures visibly and avoid presenting stale figures as current.

## 6. Analytics and statistics

The first release should report submitted responses, submissions over time, question distributions, district coverage, contact permission, and GPS quality. Retain TenkiPay readiness indicators as template-specific views.

Every chart shows count, percentage where meaningful, denominator, active filters, and version scope. Separate unanswered questions from questions skipped by logic. For multiple-choice questions, use eligible answered respondents as the denominator and explain that percentages can exceed 100% in total. Do not imply exact averages from customer-count ranges.

Generate charts from question types: distributions for choices, summaries for numeric questions, and searchable lists for free text. Keep sensitive free text and precise coordinates out of aggregate views by default. Compare versions only when question meaning remains compatible; otherwise split the results by version.

Completion rate, abandonment, duration, and channel conversion require additional event collection; existing submissions cannot supply these measures. Add these in a later phase with documented definitions for views, starts, submissions, expiry, preview/bot exclusion, and anonymous session handling. Label session metrics as session metrics rather than unique people.

## 7. Implementation foundation

Extend the data model with questionnaire identity, draft revision, lifecycle state, immutable versions scoped to questionnaire, collection settings, share sources, and response review metadata. Each submission references its questionnaire and published version. Add activity events only when implementing funnel metrics.

Use one schema-driven validation and visibility engine across the builder preview, public form, and API. Enforce limits for question count, text length, choices, and logic depth. Reject unknown or invalid structures on the server.

Separate endpoints for draft saving, validation, publication, collection state, sharing, responses, and analytics. Enforce authorization on every administrative operation. Add Owner, Editor, and Analyst permissions before introducing accounts with different responsibilities.

Migrate the existing questionnaire and historical versions without changing their answers or IDs. Introduce stable option IDs with a documented conversion for legacy string answers. Retain existing historical definitions for faithful response display. Validate the migration on a database copy and prepare a tested restore procedure before production changes.

## 8. Delivery sequence

| Phase | Work | Completion condition |
| --- | --- | --- |
| 1 | Schema-driven rules, historical compatibility, draft/publish APIs, migration | Existing questionnaire and responses behave correctly; drafts cannot alter live forms |
| 2 | Builder, question creation, sections, options, logic, draft preview | Staff can create and publish a questionnaire without code changes |
| 3 | Settings, lifecycle, stable links, QR codes, source links | Collection rules and public sharing work consistently |
| 4 | Response review, version-aware exports, general statistics | Filtered tables, exports, and charts reconcile |
| 5 | Optional funnel events, permissions, operational monitoring | New metrics have verified definitions and access controls |

## 9. Release acceptance checks

- Exercise create, edit, duplicate, reorder, remove, save, preview, publish, pause, close, and archive end to end.
- Verify nested branching, required visible questions, hidden-answer cleanup, exclusive options, and numerical/date validation on both client and server.
- Verify simultaneous editors, repeated publish clicks, submissions during publication, expired sessions, and duplicate submission retries.
- Verify draft privacy and absence of preview side effects, including external location registration.
- Confirm migrated responses render with their original wording and removed questions remain present in historical exports.
- Reconcile chart totals and exports against known fixtures, including multi-choice percentages, skipped questions, and incompatible versions.
- Test unauthorized access, role boundaries, rate limits, and export formula handling.
- Exercise phone and desktop layouts, keyboard navigation, GPS denial/timeouts, slow networks, save failures, and refresh failures.
- Run the existing automated checks and production build, then exercise API/database integration and critical browser flows. Check query performance with a representative response volume.

The recommended first milestone is phases 1 and 2: a reliable draft-and-publish builder that safely supports adding questions. Sharing and analytics then build on the same questionnaire definitions.
