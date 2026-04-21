# Progress Log

## 2026-04-21

### Objective

Diagnose why special exams were still greyed out in Studio despite multiple attempts to enable them through Tutor/Open edX configuration.

### Findings

- Waffle flags related to special exams were already present and mostly enabled.
- Runtime shell checks showed a split state:
  - `ENABLE_SPECIAL_EXAMS = True`
  - `FEATURES['ENABLE_SPECIAL_EXAMS'] = False`
  - `FEATURES['ENABLE_TIMED_EXAMS'] = True`
- The plugin in the repository had been updated, but Tutor was actually using a different active file-based plugin copy.
- The active plugin source was:
  - `C:\Users\meetb\AppData\Local\tutor-plugins\tutor-plugins\recruitment.yml`

### Changes Made

- Added `FEATURES['ENABLE_SPECIAL_EXAMS'] = True` to LMS settings.
- Added `FEATURES['ENABLE_SPECIAL_EXAMS'] = True` to CMS settings.
- Kept `ENABLE_SPECIAL_EXAMS = True` and `FEATURES['ENABLE_TIMED_EXAMS'] = True`.
- Preserved the null proctoring backend and timed exam settings.
- Removed:
  - `COURSE_WAFFLE_OVERRIDES`
  - `EXTRA_ADVANCED_SETTINGS`
  - `mfe-lms-common-settings`

### Operational Steps Performed

- Synced the repo plugin file into Tutor's active plugin directory.
- Ran `tutor config save`.
- Restarted `cms` and `lms`.
- Verified effective runtime values through Tutor shell commands.

### Verified Result

Final runtime checks showed:

- CMS special exam flags all `True`
- LMS special exam flags all `True`

This confirmed the site-wide special exam configuration mismatch was fixed.

### Follow-Up

- Validate the subsection-level Studio workflow end to end.
- Confirm that timed exam selection is available once grading and due date prerequisites are set.
- Keep the repo plugin and Tutor active plugin synchronized going forward.
