# Recruitment Plugin Status

This directory tracks the purpose, implementation status, and progress of the `recruitment` Tutor plugin used to adapt Open edX into a university test management platform.

## Directory Contents

- `overview.md`: Product goal, scope, and intended behavior of the plugin.
- `implementation-status.md`: Detailed status of implemented features, verified behavior, and known gaps.
- `progress-log.md`: Chronological record of major changes, findings, and validation steps.

## Current Summary

The plugin is focused on turning Open edX into a controlled assessment environment for university recruitment and test workflows.

Current verified outcome:

- Special exams are enabled successfully in both LMS and CMS.
- Timed exams can now be configured through Studio, subject to normal subsection requirements such as grading and due dates.
- The plugin has been simplified to remove stale or risky overrides that were interfering with platform behavior.

## Maintenance Notes

When the plugin is updated:

1. Update `implementation-status.md` with the new behavior.
2. Add a dated entry to `progress-log.md`.
3. If the product direction changes, update `overview.md` first so the implementation notes stay aligned with the goal.
