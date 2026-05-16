# Viktoria — UI / UX Design Direction

## Vision

The product should feel like:
- a premium dark-mode operating system for teams
- a modern agency control center
- a fusion of:
  - Linear / Notion / ClickUp clarity
  - cinematic enterprise dashboards
  - Victory Group’s futuristic monochrome branding

The application must NOT look like a generic Trello clone.
It should feel:
- minimal
- sharp
- futuristic
- calm
- expensive
- highly structured
- enterprise-grade

The UI should communicate:
> “This is where serious teams operate.”

---

# Core Design Philosophy

## 1. Black-first interface

The customer’s website identity is heavily based around:
- deep black backgrounds
- metallic gradients
- soft glass overlays
- geometric structure
- white typography
- subtle glow
- industrial futuristic aesthetic

The kanban system should inherit that DNA.

Primary visual language:
- matte black surfaces
- subtle borders instead of visible separators
- layered depth
- soft shadows
- restrained accent colors
- white typography hierarchy
- high spacing discipline

Avoid:
- noisy colorful interfaces
- flat Bootstrap-like layouts
- bright saturated backgrounds
- rounded playful SaaS look
- childish cards

The design must feel closer to:
- a control center
- creative operations dashboard
- cyber enterprise workspace

---

# Visual Style

## Overall Style Keywords

- Futuristic
- Premium
- Structured
- Industrial
- Minimal
- Cybernetic
- Enterprise
- Cinematic
- Modular
- Dark luxury

---

# Color System

## Primary Palette

### Backgrounds

| Token | Color | Usage |
|---|---|---|
| bg-primary | #050505 | main app background |
| bg-secondary | #0B0B0B | cards / panels |
| bg-tertiary | #111111 | hover / elevated surfaces |
| bg-glass | rgba(255,255,255,0.03) | glass overlays |
| bg-soft | #161616 | subtle differentiation |

---

### Borders

| Token | Color |
|---|---|
| border-primary | rgba(255,255,255,0.08) |
| border-soft | rgba(255,255,255,0.04) |
| border-focus | rgba(255,255,255,0.18) |

Borders should be extremely subtle.
Most separation should come from:
- spacing
- layering
- contrast

NOT thick outlines.

---

### Typography

| Token | Color |
|---|---|
| text-primary | #FFFFFF |
| text-secondary | rgba(255,255,255,0.72) |
| text-muted | rgba(255,255,255,0.45) |
| text-disabled | rgba(255,255,255,0.25) |

---

### Accent Colors

Use accents sparingly.

| Accent | Color | Usage |
|---|---|---|
| electric blue | #3B82F6 | active states |
| neon violet | #8B5CF6 | analytics / automation |
| emerald | #10B981 | success |
| amber | #F59E0B | warnings |
| rose | #EF4444 | destructive actions |

Important:
The UI should remain mostly monochrome.
Accent colors are signals, not decoration.

---

# Typography

## General Direction

Typography should imitate the customer website style:
- large uppercase geometric headlines
- compact spacing
- futuristic feel
- elegant readability

Suggested fonts:
- Inter
- Satoshi
- Space Grotesk
- General Sans

---

## Heading Style

### Hero / Section Titles

Characteristics:
- uppercase
- bold
- tight line height
- aggressive scale
- large tracking

Examples:
- PROJECT AUTOMATION
- TEAM OPERATIONS
- WORKFLOW ANALYTICS

---

## Body Text

Characteristics:
- clean
- minimal
- soft contrast
- readable in dark mode
- lightweight

Never use overly bright secondary text.

---

# Layout System

## General Layout

The application layout should follow:

```text
┌──────────────────────────────────────────────┐
│ Top Navigation                               │
├──────────────┬───────────────────────────────┤
│ Sidebar      │ Main Workspace                │
│              │                               │
│              │                               │
│              │                               │
└──────────────┴───────────────────────────────┘
```

---

## Sidebar

Sidebar should resemble:
- premium desktop application
- operating system navigation
- agency command center

### Sidebar Characteristics

- fixed width
- matte black
- subtle border-right
- icon-first navigation
- compact spacing
- soft hover glow
- floating active state

### Navigation Items

Sections:
- Overview
- Boards
- Tasks
- Timeline
- Analytics
- Automations
- Team
- Reports
- Files
- Settings

---

## Top Navigation

Minimal and clean.

Contains:
- workspace switcher
- search
- notifications
- AI assistant access
- profile dropdown
- quick create button

Should NOT feel crowded.

---

# Kanban Board Design

## Core Goal

The board should feel:
- alive
- premium
- dense but readable
- highly interactive

Reference inspirations:
- Linear
- Height.app
- Motion
- modern Figma panels
- cinematic dashboard systems

---

# Columns

## Column Design

Columns should:
- blend into background
- not look boxed-in
- feel modular
- have subtle vertical separation

### Column Header

Contains:
- title
- task count
- automation status
- menu actions

Example:

```text
TODO                 12
```

or

```text
IN REVIEW        ⚡ 4
```

---

# Task Cards

## Card Style

Cards are the core visual element.

They must feel:
- layered
- tactile
- premium
- draggable
- dynamic

### Card Appearance

- dark surfaces
- soft gradients
- 16-20px radius
- subtle border
- internal spacing
- minimal noise

### Card Hover State

On hover:
- slightly elevate
- subtle glow
- softer shadow
- stronger border contrast
- cursor responsiveness

---

## Card Content Hierarchy

### Structure

```text
Task Title
Metadata row
Tags
Assignees
Progress / Automation
```

---

## Metadata

Use tiny icon metadata.

Examples:
- due date
- comments
- attachments
- subtasks
- automation triggers

Should remain visually lightweight.

---

## Tags

Tags should:
- be compact
- slightly glowing
- low saturation
- rounded pills

Examples:
- DESIGN
- SEO
- URGENT
- CLIENT
- AUTOMATION

---

## Assignees

Use stacked avatars.

Style:
- small
- clean
- subtle border
- floating above card surface

---

# Automation UI

This is the differentiator.
The system must visually communicate automation.

---

## Automation Indicators

Tasks with active automation should display:
- glowing lightning icon
- animated pulse
- active workflow state

Example:

```text
⚡ Auto move after approval
```

---

## Workflow Builder

The automation builder should look like:
- futuristic node editor
- dark modular pipeline
- cinematic data flow

Inspired by:
- n8n
- Framer flows
- Unreal blueprints
- Linear automation UI

---

## Automation Node Style

Nodes should:
- float on dark background
- use soft glow
- use thin connection lines
- animate subtly

Node types:
- Trigger
- Condition
- Action
- Integration
- Delay
- Notification

---

# Analytics Design

Analytics pages should feel like:
- mission control
- executive dashboard
- premium data visualization

---

## Charts

Charts should:
- use glowing lines
- thin strokes
- soft gradients
- dark backgrounds
- minimal grid visibility

Avoid:
- colorful pie charts
- overly corporate dashboards
- Excel-like visuals

---

## Analytics Cards

Use:
- glass panels
- large metrics
- soft gradients
- subtle motion

Example metrics:
- throughput
- cycle time
- blocked tasks
- automation efficiency
- workload distribution

---

# Motion Design

## Philosophy

Everything should move subtly.
Nothing should feel static.

But:
- motion must remain elegant
- never distracting
- never playful

---

## Motion Characteristics

Use:
- soft fades
- opacity transitions
- elevation transitions
- gentle scaling
- magnetic hover behavior
- smooth drag animations

Avoid:
- bouncy animations
- exaggerated easing
- cartoon effects

---

# Background Effects

The customer website heavily uses:
- gradient lighting
- textured grids
- metallic depth
- soft radial highlights

These should be adapted carefully.

---

## Recommended Background System

### Main Background

Use:
- pure dark base
- subtle noise texture
- faint grid
- radial lighting in corners

Example:

```css
background:
 radial-gradient(circle at top left, rgba(255,255,255,0.05), transparent 40%),
 radial-gradient(circle at bottom right, rgba(139,92,246,0.05), transparent 40%),
 #050505;
```

---

## Dot Matrix Texture

Inspired by the client website.

Use very subtly behind:
- hero dashboards
- analytics pages
- onboarding
- empty states

Must NOT reduce readability.

---

# Glassmorphism Usage

Glass effects should be:
- minimal
- premium
- rare

Use only for:
- floating modals
- command palette
- AI assistant
- top overlays

Avoid making the whole UI glassy.

---

# AI Assistant Design

The AI assistant should feel like:
- embedded operator
- futuristic copilot
- workflow intelligence layer

Not a generic chatbot.

---

## AI Panel Style

- dark floating side panel
- soft blur
- glowing accent
- command-oriented
- compact

Examples:
- “Generate sprint plan”
- “Summarize blockers”
- “Auto-assign tasks”
- “Create workflow”

---

# Empty States

Empty states should feel elegant.

Use:
- monochrome illustrations
- geometric shapes
- subtle motion
- meaningful guidance

Avoid:
- playful cartoons
- generic SaaS illustrations

---

# Tables & Lists

Tables should resemble:
- Notion
- Linear
- enterprise terminal systems

Characteristics:
- extremely clean
- minimal borders
- hover-based separation
- compact spacing
- dark surfaces

---

# Search Experience

Search should feel instantaneous.

Use:
- command palette aesthetic
- dark overlay
- keyboard-first interactions
- fuzzy search
- quick actions

Inspired by:
- Raycast
- Linear
- Spotlight

---

# Responsive Design

## Desktop First

The system is primarily desktop-oriented.

Prioritize:
- widescreen layouts
- dense productivity views
- multi-panel workflows

---

## Tablet

Support:
- collapsible sidebar
- stacked analytics
- simplified board view

---

## Mobile

Mobile should:
- focus on task updates
- quick comments
- notifications
- approvals
- status changes

Not full enterprise editing.

---

# Technical UI Recommendations

## Frontend Stack

Recommended:
- Next.js
- Tailwind
- Framer Motion
- shadcn/ui
- Zustand
- React Query

---

## UI Libraries

Good additions:
- dnd-kit
- cmdk
- recharts
- lucide-react

---

# Component Styling Rules

## Border Radius

| Component | Radius |
|---|---|
| buttons | 12px |
| cards | 18px |
| modals | 24px |
| pills | 999px |

---

## Shadows

Shadows must be:
- soft
- blurred
- low opacity

Never use harsh shadows.

---

## Spacing

Use generous spacing.

The UI should breathe.

Avoid:
- cramped cards
- dense unreadable columns
- excessive information stacking

---

# Differentiators From Generic Kanban Apps

## Viktoria Should Feel Like

- an agency operating system
- automation command center
- workflow intelligence platform
- premium enterprise tool

NOT:
- Trello clone
- startup template
- colorful SaaS dashboard

---

# Unique Brand Fusion

## What Must Be Taken From Customer Website

### 1. Typography Mood
- futuristic uppercase headers
- geometric text structure
- sharp spacing

### 2. Monochrome Identity
- black-dominant visuals
- grayscale surfaces
- restrained accents

### 3. Industrial Premium Feel
- metallic lighting
- modular grids
- cinematic composition

### 4. Structured Layout Language
- boxed sections
- strong alignment
- architectural spacing

### 5. Subtle Futuristic Graphics
- dot textures
- metallic objects
- radial lighting
- soft gradients

---

# What Must Be Taken From Modern SaaS References

### 1. Productivity Clarity
- clean information hierarchy
- readable spacing
- practical interactions

### 2. Board UX
- smooth drag-and-drop
- excellent responsiveness
- modular task structure

### 3. Modern Dashboard Behavior
- adaptive panels
- command palette
- keyboard navigation
- live updates

### 4. Dense Yet Elegant Information Design
- analytics
- timeline views
- kanban views
- calendar integration

---

# Final Design Target

If the design is successful, the product should feel like:

> “Linear meets a futuristic enterprise agency OS.”

or

> “A cyberpunk premium project management system built for serious marketing operations.”

The user should instantly recognize:
- premium quality
- modern architecture
- automation-first thinking
- strong brand identity
- high-end enterprise feel

without losing:
- usability
- readability
- productivity speed
- interaction clarity
- workflow efficiency

