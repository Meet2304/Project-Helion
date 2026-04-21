# Plugin Overview

## Name

`recruitment`

## Goal

The goal of this plugin is to configure Tutor/Open edX as a secure and focused test management platform for universities.

The intended platform behavior is:

- private or invitation-controlled access
- limited public discovery of courses and assessments
- support for timed assessment workflows
- stable behavior across LMS, CMS, and related Open edX services

## Primary Use Case

Universities use the platform to manage recruitment tests, assessment workflows, and controlled learner access without exposing the broader course catalog or standard public signup flows.

## Functional Objectives

- Disable public account creation.
- Reduce public visibility of courses and course marketing pages.
- Support timed exam delivery through Open edX special exam functionality.
- Keep configuration centralized in a Tutor plugin so the environment can be regenerated consistently.

## Non-Goals

These are currently outside the scope of the plugin unless added later:

- third-party live proctoring vendor integration
- custom Studio UI development
- custom MFE feature development for exams
- analytics/reporting dashboards
- institution-specific workflow automation outside platform settings

## Design Principles

- Prefer native Open edX settings over custom overrides.
- Keep the plugin declarative and easy to regenerate through Tutor.
- Avoid replacing built-in advanced settings registries unless absolutely necessary.
- Favor platform-supported exam configuration over MFE-specific workarounds.
