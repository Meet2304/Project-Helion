# Implementation Status

## Current Plugin File

Primary config source in this repo:

- [recruitment.yml](/d:/Projects_Ad%20Astra/Project_18_Helion/recruitment.yml)

Active Tutor file-based plugin used during validation:

- `C:\Users\meetb\AppData\Local\tutor-plugins\tutor-plugins\recruitment.yml`

## Implemented Functionality

### 1. Platform Identity and Access Control

Implemented:

- custom `PLATFORM_NAME`
- CORS settings for local development
- CSRF trusted origins for local development
- login redirect whitelist
- public account creation disabled
- registration-related UI behavior restricted

Purpose:

- make the platform behave as a controlled institutional environment rather than a public MOOC catalog

### 2. Public Visibility Restrictions

Implemented:

- catalog visibility restrictions
- course discovery disabled
- marketing site disabled
- course about page visibility restricted
- default course about visibility set to private

Purpose:

- reduce unintended public exposure of test content and test-related course pages

### 3. Timed and Special Exam Enablement

Implemented:

- `ENABLE_SPECIAL_EXAMS = True` in LMS
- `ENABLE_SPECIAL_EXAMS = True` in CMS
- `FEATURES['ENABLE_SPECIAL_EXAMS'] = True` in LMS
- `FEATURES['ENABLE_SPECIAL_EXAMS'] = True` in CMS
- `FEATURES['ENABLE_TIMED_EXAMS'] = True` in LMS
- `FEATURES['ENABLE_TIMED_EXAMS'] = True` in CMS
- null proctoring backend configured
- timed exams allowed
- proctored exams disabled by configuration

Purpose:

- enable timed exams without requiring a third-party proctoring vendor

### 4. Exam Runtime Defaults

Implemented:

- calculator block disabled by default
- pause widget disabled

Purpose:

- make exam behavior more controlled and predictable unless a course explicitly opts into other behavior

## Verified Working State

The following was verified in the live Tutor environment after syncing the active plugin file, saving Tutor config, and restarting LMS/CMS:

- CMS `ENABLE_SPECIAL_EXAMS = True`
- CMS `FEATURES['ENABLE_SPECIAL_EXAMS'] = True`
- CMS `FEATURES['ENABLE_TIMED_EXAMS'] = True`
- LMS `ENABLE_SPECIAL_EXAMS = True`
- LMS `FEATURES['ENABLE_SPECIAL_EXAMS'] = True`
- LMS `FEATURES['ENABLE_TIMED_EXAMS'] = True`

This resolved the prior split-state issue where:

- `ENABLE_SPECIAL_EXAMS` was `True`
- `FEATURES['ENABLE_SPECIAL_EXAMS']` was still `False`

That mismatch was the key blocker preventing the special exam control from behaving correctly in Studio.

## Removed or Simplified During Debugging

Removed from the plugin:

- `COURSE_WAFFLE_OVERRIDES`
- `EXTRA_ADVANCED_SETTINGS`
- `mfe-lms-common-settings`

Reason:

- these additions were either stale, misleading, or risky during debugging
- they were not the primary mechanism required to enable timed exams
- some of them could interfere with the platform's native settings behavior

## Important Operational Finding

The repo copy of `recruitment.yml` was not the only source in use.

Tutor was loading the active plugin from:

- `C:\Users\meetb\AppData\Local\tutor-plugins\tutor-plugins\recruitment.yml`

This means future changes must either:

- be copied from the repo file into the Tutor file-based plugin root, or
- be managed directly from the Tutor plugin root with a clear sync process

## Remaining Validation Steps

Still recommended in the UI:

- create or open a subsection with at least one problem
- set `Grade as` to a graded assignment type
- set a due date and time
- open the subsection `Advanced` tab
- verify `Timed` is selectable
- publish and verify learner-side timer behavior in LMS

## Known Risks

- Plugin drift between the repo copy and the active Tutor plugin copy can cause confusion.
- Open edX release differences may change which flags are read by the UI.
- Special exam controls may still appear disabled if subsection-level prerequisites are not set, even when site-wide flags are correct.
