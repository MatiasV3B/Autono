# Contributing to Autono

First off, thank you for taking the time to contribute to Autono! Open-source contributions from developers like you help make AI-assisted browsing better for everyone.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please report unacceptable behavior following the guidelines in that document.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the [Issue Tracker](../../issues) to see if the problem has already been reported:
- Use our [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md).
- Provide a clear, descriptive title and steps to reproduce.
- Include your operating system, Chrome version, model selected, and any relevant console errors.

### Suggesting Enhancements

Feature requests are always welcome!
- Use our [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md).
- Explain why this enhancement would be useful and outline potential workflows or UI ideas.

### Pull Requests

1. **Fork the repository** and clone your fork locally.
2. **Create a branch** off `main` with a descriptive name (e.g. `feat/mcp-tool-support` or `fix/overlay-positioning`).
3. **Make your changes**:
   - Keep changes modular, clean, and well-documented.
   - Test your changes manually by loading the unpacked extension in Chrome.
   - Verify that dynamic icon switching, Chat mode, and Cowork mode work as expected.
4. **Push your branch** to your fork and submit a Pull Request targeting `main`.
5. Fill out the [Pull Request Template](.github/pull_request_template.md).

## Development Guidelines

- **Vanilla JS**: Runtime code in `Autono` uses modern, standards-compliant vanilla JavaScript and Chrome Manifest V3 APIs. Avoid adding heavy client-side runtime build dependencies unless strictly necessary.
- **Privacy & Safety**: Never commit API keys, personal file paths, tokens, or hardcoded personal credentials.
- **Styling**: Maintain the ambient dark theme design tokens and responsive side panel layout.

Thank you for helping make Autono great!
