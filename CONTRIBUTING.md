# Contributing to Copyright Compendium

## Agent Rules
**These rules must be followed by any AI agent working on this repository.**

1.  **Conventional Commits**: All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.
    -   Structure: `type(scope): subject`
    -   Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
    -   Example: `feat(ui): add new search bar`
2.  **Versioning**: Versioning is handled automatically upon merge to the `main` branch.
    -   Do not manually bump the version in `package.json` unless specifically instructed.
    -   The `standard-version` tool will determine the next version based on the commit messages (fix -> patch, feat -> minor, BREAKING CHANGE -> major).
3.  **Modifying Code**: The frontend code is located in the `CompendiumUI` directory.
    -   Always run tests after modification: `npm test` in `CompendiumUI`.
4.  **Pull Requests**:
    -   Ensure PR titles also follow Conventional Commits, as they may be used for squash merges.

## Development Workflow

### Setup
1.  Navigate to `CompendiumUI`.
2.  Run `npm install`.

### Testing
Run `npm test` to execute the test suite.
