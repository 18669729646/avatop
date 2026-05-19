---
name: "superpowers"
description: "Agentic skills framework for systematic software development. Invoke when starting new features, bug fixes, or any creative work to ensure proper planning, TDD, and code review workflows."
---

# Superpowers - Agentic Skills Framework

## Core Philosophy

**NOTHING gets built without a plan.** Before any creative work—features, components, bug fixes, or behavior changes—you MUST follow the workflow.

## Mandatory Workflow

```
brainstorming → design approval → writing-plans → implementation → review → finish
```

---

## Phase 1: Brainstorming

**Trigger**: User asks for ANY new functionality, feature, bug fix, or change.

**DO NOT skip to code immediately.** Instead:

1. Ask clarifying questions to understand the REAL goal
2. Explore alternatives and trade-offs
3. Present design in chunks (200-300 words) for validation
4. Document the agreed design in `docs/superpowers/specs/`

**Questions to ask**:
- What problem does this solve?
- Who are the users?
- What are the edge cases?
- How does it integrate with existing code?
- What could go wrong?

---

## Phase 2: Writing Plans

After design approval, break work into **2-5 minute tasks** that:
- Have exact file paths
- Include complete code or precise instructions
- Define verification steps

Save plan to `docs/superpowers/plans/`

**Plan template**:
```
## Step N: [Task Name]
**Files**: [exact paths]
**What**: [precise description]
**Verify**: [how to confirm it works]
```

---

## Phase 3: Test-Driven Development

**For ANY implementation task**:

1. **RED**: Write a failing test first
2. **GREEN**: Write minimal code to pass the test
3. **REFACTOR**: Improve code while keeping tests green

**Anti-patterns to avoid**:
- Writing code before tests
- Testing implementation details instead of behavior
- Incomplete mocks that hide structural assumptions

---

## Phase 4: Code Review

Before marking a task complete:

1. **Spec compliance**: Does it actually match the plan?
2. **Code quality**: Clean, maintainable, follows project conventions?
3. **Test coverage**: Are edge cases covered?

**Review checklist**:
- [ ] Matches specification?
- [ ] No placeholder comments (TBD, TODO)?
- [ ] Proper error handling?
- [ ] Logging for important operations?
- [ ] TypeScript types correct?
- [ ] Tests cover edge cases?

---

## Phase 5: Finishing

When all tasks complete:

1. Verify all tests pass
2. Run lint and typecheck
3. Present options: merge, PR, or keep working
4. Clean up temporary files

---

## Rationalization Red Flags

**STOP** if you catch yourself thinking:

- "This is simple, no need for a design" → **WRONG**
- "I know what to do, let me just write code" → **WRONG**
- "Let me explore first, then ask questions" → **WRONG**
- "Let me gather more context" as excuse to skip brainstorming → **WRONG**

---

## File Structure

```
docs/superpowers/
├── specs/           # Design specifications
└── plans/           # Implementation plans
```

---

## Key Principles

| Principle | Description |
|-----------|-------------|
| **TDD** | Write tests first, always |
| **YAGNI** | You Aren't Gonna Need It - don't over-engineer |
| **DRY** | Don't Repeat Yourself |
| **Small steps** | 2-5 minute tasks prevent drift |
| **Verify before declaring success** | Check it actually works |

---

## When NOT to use this skill

- Simple read-only queries
- Questions about existing code
- Already have a clear, approved plan
- Emergency hotfixes (document after)

---

## Reference

Original project: [obra/superpowers](https://github.com/obra/superpowers)
170k Stars - AI编程Agent的工程化技能框架
