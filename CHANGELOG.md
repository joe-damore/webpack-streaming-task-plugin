# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2019-12-31
### Added
- NPM status image to README.md
- Error message when `task` callback returns falsy values

### Changed
- Slight improvements to README.md whitespace
- Slight improvements to README.md 'Basic Usage' example

### Fixed
- Fix task duration calculation
- Prevent subdirectories of existing watch directories from being watched
- Remove existing watch directories that are subdirectories of new watch directories

## [0.1.0] - 2019-12-31
### Added
- Initial plugin file
- `source` option
- `destination` option
- `task` option
- `name` option
- `always` option
- `watchSourceDirectories` option
