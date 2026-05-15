---
argument-hint: [feature description]
description: Orchestrate full feature implementation cycle
---

# Task

You are orchestrating implementation for feature: $ARGUMENTS

## Workflow Overview

Multi-agent workflow with clear separation of concerns:

1. **design** - Designs UI/UX, component structure (NO CODE)
2. **architect** - Designs technical architecture, data contracts (NO CODE)
3. **dev** - Implements code following architecture
4. **cto** - Code review: Functional Clarity, security, architecture consistency
5. **keykeeper** - Updates project documentation with stable solutions (after feature completion)

## Stage Implementation Loop

### 1. Design Phase
Run **design** agent:
- Read `agents/features/FEAT-XXXX-названиеX-название/README.md` for requirements
- Check `agents/context/UI_GUIDELINES.md` for design patterns
- Create `agents/features/FEAT-XXXX-названиеX-название/FEAT-XXXX-DESIGN-01.md`

### 2. Architecture Phase
Run **architect** agent:
- Read `README.md` for requirements
- Read `FEAT-XXXX-DESIGN-01.md` for UI structure
- Check `agents/context/PROJECT.md` for current architecture
- Check `review-request-changes/` for previous issues
- Create `agents/features/FEAT-XXXX-названиеX-название/FEAT-XXXX-PLAN-01.md`

### 3. Implementation Phase
Run **dev** agent:
- Read `FEAT-XXXX-PLAN-01.md` (or latest version)
- Read `FEAT-XXXX-DESIGN-01.md`
- Check `review-request-changes/` for unsolved issues
- Implement code following architecture and design
- Fix issues from review files
- Mark solved issues as `FEAT-XXXX-ISSUE-XXX_solved.md`
- Update `agents/context/CHANGELOG.md`

**Escalation to architect:**
If dev finds issues requiring architecture revision:
1. Create issue file with `[NEEDS-ARCHITECTURE-REVIEW]`
2. Run **architect** agent to create new plan version (FEAT-XXXX-PLAN-02.md)
3. Continue implementation with updated plan

### 4. CTO Code Review Phase
Run **cto** agent:
- Read completed feature artifacts (README, DESIGN, PLAN)
- Review code through Функциональная Ясность principles
- Check: Error Hiding, security (OWASP), architecture consistency
- Verify infrastructure principles compliance (`project/artifacts/infrastructure-principles.md`, если существует)
- Create issue files if problems found → return to Step 3
- If approved → Move to Step 5

### 5. Documentation Update Phase
Run **keykeeper** agent:
- Read completed feature artifacts (README.md, DESIGN, PLAN, test_cases, solved issues)
- Extract stable architectural decisions and patterns
- Update `AGENTS.md` (detailed for developers)
- Update `llms.txt` (compressed for AI agents)

## Example Directory Structure

```
agents/
  context/
    CHANGELOG.md                             # Dev history
    UI_GUIDELINES.md                         # Design principles
    PROJECT.md                               # Technical spec
  
  features/
    FEAT-0005-responsive-design/
      README.md                              # Requirements (from plan-feat)
      FEAT-0005-DESIGN-01.md                # UI/UX design (from design)
      FEAT-0005-PLAN-01.md                  # Architecture plan (from architect)
      FEAT-0005-PLAN-02.md                  # Revised plan (if escalated)
      metrics.yaml                           # Development metrics
      
      review-request-changes/                # Issue files (from cto)
        FEAT-0005-ISSUE-001.md
        FEAT-0005-ISSUE-001_solved.md

AGENTS.md                                    # Detailed docs (updated by keykeeper)
llms.txt                                     # Compressed docs (updated by keykeeper)
```

## Critical Rules

**Separation of concerns:**
- **design** = UX/UI design, visual structure (NO CODE, NO TESTS)
- **architect** = Technical architecture, data contracts (NO CODE, NO TESTS)
- **dev** = Code implementation, fixing deviations (NO TESTS)
- **cto** = Code review, architecture compliance, infrastructure principles (NO CODE)
- **keykeeper** = Documentation updates with stable solutions (NO CODE, NO FEATURES)

**Workflow rules:**
- All feature artifacts in `agents/features/FEAT-XXXX-названиеX-название/`
- Shared context in `agents/context/`
- File naming: FEAT-XXXX-DESIGN-01, FEAT-XXXX-PLAN-01, FEAT-XXXX-ISSUE-001
- Fix loop always returns to dev
- dev can escalate to architect when architecture revision needed
- Loop continues until test finds no issues
- After feature completion, keykeeper updates project documentation

**Feature completion criteria:**
- ✅ All issues in review-request-changes/ marked as `_solved`
- ✅ CTO code review passed
- ✅ Implementation matches design and architecture
- ✅ `agents/context/CHANGELOG.md` updated
- ✅ Metrics saved in `metrics.yaml`
- ✅ Project documentation updated (AGENTS.md, llms.txt)