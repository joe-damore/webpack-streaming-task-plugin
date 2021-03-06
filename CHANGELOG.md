# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2020-01-04
### Changed
- Slight improvements to README.md 'Basic Usage' example
- Clarify distinction between task execution error and task output error
- Use `bach` to execute tasks

### Fixed
- Prevent error when `watchMode` option is not specified
- Prevent piping to `vfs.dest` when `destination` is `null`

## [0.2.0] - 2020-01-03
### Added
- `watchMode.includeSourceDirectories` option to replace `watchSourceDirectories`
- `watchMode.alwaysRun` option to replace `always`
- `watchMode.skipInitialRun` option to skip task during inital run while in watch mode
- `watchMode.changedFilesOnly` option only include changed files in task stream while in watch mode
- Additional keywords to `package.json`

### Changed
- Deprecate `watchSourceDirectories` option in favor of `watchMode.includeSourceDirectories`
- Deprecate `always` option in favor of `watchMode.alwaysRun`

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
