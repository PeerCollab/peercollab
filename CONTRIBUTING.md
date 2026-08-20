# Contributing to PeerCollab

Welcome to the PeerCollab codebase. This guide explains how we work together as a team to keep the repository clean, consistent, and conflict-free.

<hr>

## Table of Contents

- [Branch Strategy](#branch-strategy)
- [Branch Naming Convention](#branch-naming-convention)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Process](#pull-request-process)
- [Code Review Rules](#code-review-rules)
- [Migration Rules](#migration-rules)
- [General Rules](#general-rules)
- [Quick Reference](#quick-reference)

<hr>

## Branch Strategy

We use three levels of branches:

main ─── stable, demo-ready code only. Never pushed to directly.
└── dev ─── integration branch. All features merge here first.
└── feature/xxx ─── individual work branches.

- `main` - reflects the final stable version of the project. Only merged from `dev` when the team agrees everything is working and tested.
- `dev` - the active development branch. All pull requests target this branch.
- `feature/*`, `fix/*`, `docs/*` - individual work branches created from `dev`.

<hr>

## Branch Naming Convention

Always create your branch from `dev`, not from `main`.

```bash
git checkout dev
git pull origin dev
git checkout -b feature/your-branch-name
```

Use the following prefixes:

| Prefix | When to Use | Example |
|---|---|---|
| `feature/` | New feature or module | `feature/course-management` |
| `fix/` | Bug fix | `fix/login-redirect-error` |
| `docs/` | Documentation update | `docs/update-readme` |
| `refactor/` | Code restructure without new feature | `refactor/auth-utils` |
| `style/` | UI or CSS changes only | `style/kanban-card-layout` |

Keep branch names lowercase, use hyphens not underscores, be specific.

**Good:**
- feature/kanban-drag-drop
- feature/project-file-upload
- fix/invite-code-duplicate-check


**Bad:**

- feature/member-work
- my-changes
- update
- test123

<hr>

## Commit Message Convention

Every commit message must follow this format:

type: short description in present tense


| Type | When to Use |
|---|---|
| `feat` | Adding a new feature |
| `fix` | Fixing a bug |
| `docs` | Documentation changes |
| `style` | CSS or UI changes, no logic change |
| `refactor` | Restructuring code without changing behaviour |
| `test` | Adding or updating tests |
| `chore` | Setup tasks, config changes, dependencies |

**Rules:**
- Use present tense - write `add login route` not `added login route`
- Keep the first line under 72 characters
- Be specific - describe what the commit does, not what you did

**Good:**

- feat: add course creation endpoint
- feat: render kanban board with drag and drop
- fix: correct JWT token expiry calculation
- docs: add database setup instructions to README
- chore: add python-multipart to requirements.txt
- style: update task card priority badge colours


**Bad:**

- update
- fixed stuff
- changes
- wip
- done

<hr>

## Pull Request Process

1. Make sure your branch is up to date with `dev` before opening a PR:
```bash
git checkout dev
git pull origin dev
git checkout your-branch-name
git merge dev
```

2. Push your branch to GitHub:
```bash
git push origin your-branch-name
```

3. Open a Pull Request on GitHub:
   - Base branch: `dev`
   - Compare branch: your feature branch
   - Title: same format as commit message - `feat: add kanban board`
   - Description: briefly explain what you built and any notes for the reviewer

4. Request a review from at least one other team member

5. Wait for approval before merging - do not merge your own PR without a review

6. After approval, merge into `dev` and delete your feature branch

7. `dev` is merged into `main` only when the team agrees the current state is stable - this happens after each sprint or before a milestone

<hr>

## Code Review Rules

**As a reviewer:**
- Review within 24 hours of the PR being opened
- Read through the code carefully - check that it works and makes sense
- Leave comments on specific lines if something needs to change
- Approve only when you are satisfied the code is ready

**As the author:**
- Respond to every comment - either make the change or explain why you did not
- Do not merge until all comments are resolved and you have at least one approval

<hr>

## Migration Rules

**Only the Team Lead runs Alembic migrations. No one else.**

This is the most important rule in this document. Running migrations from multiple branches simultaneously will break the database for the entire team.

**The process:**
1. You finish your model file and push your branch to `dev`
2. You message the team lead - "My model is ready, please run migration"
3. Team lead pulls `dev`, runs `alembic revision --autogenerate` and `alembic upgrade head`
4. Team lead confirms the table exists in MySQL and messages you - "Migration done, your table is ready"
5. You can now start building your routes and templates

**Never run:**
```bash
alembic revision --autogenerate
alembic upgrade head
alembic downgrade
```
on your own without team lead's confirmation.

<hr>

## General Rules

- Always pull the latest `dev` before creating a new branch - never work on outdated code
- Never push directly to `main` or `dev` - always go through a pull request
- Never commit your `.env` file - it contains secret keys and passwords
- If you are stuck on something for more than a day, raise it in the group chat immediately 
- Update your JIRA task status as you work by moving cards from To Do to In Progress to Done
- Push your work at the end of every working session and do not keep the code only on your local machine
- If you accidentally push to the wrong branch, tell the team lead immediately - do not try to fix it alone

<hr>

## Quick Reference

```bash
# Start new feature
git checkout dev
git pull origin dev
git checkout -b feature/your-feature-name

# Save your work
git add .
git commit -m "feat: describe what you did"
git push origin feature/your-feature-name

# Keep your branch updated with dev
git merge dev

# After PR is merged, clean up
git checkout dev
git pull origin dev
git branch -d feature/your-feature-name
```

<hr>

*PeerCollab | EER4189 Software Design in Group | OUSL 2025/26*