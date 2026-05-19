---
name: "best-minds"
description: "Simulates expert thinking by asking 'Who knows this best? What would they say?' Invoke when designing architecture, solving complex problems, or needing expert-level analysis."
---

# Best Minds - Expert Thinking Simulator

## Core Philosophy

**NOT "What do you think?" but "Who in the world knows this best? What would they say?"**

When facing a complex problem, instead of relying solely on general knowledge, identify and simulate the thinking of the foremost expert in that domain.

---

## How It Works

### Step 1: Identify the Expert

Ask: "Who are THE world experts on this topic?"

| Problem Domain | Expert Reference |
|----------------|-----------------|
| System Architecture | Martin Fowler, Kent Beck, Robert C. Martin |
| Performance Optimization | Brendan Gregg, Linus Torvalds |
| Database Design | Michael Stonebraker, Pat Helland |
| Frontend/React | Dan Abramov, Sebastian Markbåge |
| Backend/Distributed Systems | Werner Vogels, Jeff Dean |
| Security | Dan Boneh, Bruce Schneier |
| JavaScript/TypeScript | Ryan Dahl, Anders Hejlsberg |
| DevOps/Cloud | Kelsey Hightower, Martin Fowler |
| AI/ML | Andrew Ng, Ian Goodfellow |

### Step 2: Ask "What Would They Say?"

Simulate their perspective:
- What would be their first question?
- What would they immediately rule out?
- What patterns would they recognize?
- What would they flag as a red flag?
- What would their solution approach look like?

### Step 3: Synthesize Expert Thinking

Combine insights from multiple experts when the problem spans domains.

---

## When to Use

| Scenario | Which Expert? |
|----------|---------------|
| Designing API | API design: Roy Fielding, Leszek Orfila |
| Database schema | Data modeling: Stonebraker, Ralph Kimball |
| React architecture | Dan Abramov, Sophie Alpert |
| Microservices | Chris Richardson, Sam Newman |
| Performance | Brendan Gregg, Peter Norvig |
| Security review | Bruce Schneier, Thomas Ptacek |
| Code review | Robert C. Martin, Trisha Gee |
| TypeScript patterns | Anders Hejlsberg, Daniel Rosenwasser |
| Next.js optimization | Guillermo Rauch, Lee Robinson |
| Video streaming | Jan Ozer, Felix Rauch |

---

## Structured Thinking Template

When invoked, for any problem:

```
## Problem: [Brief description]

## Expert Identification
Who knows this best? → [Expert name(s)]
Why? → [Their relevant experience]

## Expert Mental Model
- What would they ask first?
- What would they rule out immediately?
- What patterns would they see?
- What would they do differently?

## Expert Solution Approach
[Simulated expert response]

## Synthesis
[Combined insights + practical application]
```

---

## Examples

### Example 1: API Design Problem
```
User: "How should I design this API for video uploads?"

Best Minds Response:
> Let me channel Roy Fielding's REST philosophy and Leszek Orfila's practical API design experience...

Fielding would ask:
- Is this truly a resource or an action?
- What are the idempotent operations?
- What's the caching behavior?

Leszek would add:
- What's the payload size limit?
- Should this be async?
- What's the retry strategy?
```

### Example 2: Database Performance
```
User: "This query is running very slow"

Best Minds Response:
> Let me apply Brendan Gregg's performance analysis methodology and Stonebraker's database expertise...

Brendan would say:
- Measure first, don't guess
- Is it CPU, IO, or network?
- What's the execution plan?

Stonebraker would add:
- Is this OLTP or OLAP workload?
- Are proper indexes in place?
- What's the data distribution?
```

---

## Anti-Patterns

**DON'T:**
- Use this as justification without substantive reasoning
- Pick random experts just for the sake of it
- Ignore contradictions between expert opinions
- Apply expert advice without considering context

**DO:**
- Choose experts based on genuine relevance
- Apply reasoning, not just names
- Acknowledge when experts disagree
- Combine multiple expert views when useful

---

## Combining with Superpowers

| Phase | Integration |
|-------|-------------|
| Brainstorming | Use Best Minds to explore problem space from expert angles |
| Writing Plans | Apply expert thinking to task breakdown |
| Implementation | Reference expert patterns in code |
| Review | Channel expert perspective during code review |

---

## Reference

Inspired by: Ceeon's Best Minds skill
Original concept: Expert simulation through targeted persona thinking
