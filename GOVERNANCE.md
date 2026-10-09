# How worldhood is run

worldhood is a young project, so this is short on purpose. It will grow as more people join.

## Who decides

[Lasse](https://www.linkedin.com/in/lassesaari/) leads the project for now and has the final say
on direction, the shared engine and what goes live on worldhood.org. Area maintainers (listed in
each area's `extension.json` and in [`.github/CODEOWNERS`](.github/CODEOWNERS)) look after their
part of the map and review changes to it.

Decisions are made in the open, on GitHub: in issues, pull requests and discussions. Chat on
[Discord](https://discord.gg/c6SaPvxhJG) is for talking things through. Anything that needs a
decision ends up written down on GitHub.

## The quality bar

We would rather have a few places that feel real than many that don't.

- **Cities** go live only when someone who lives there recognises every street: the right
  buildings, trees, public transport, signs and paving, checked against photos. Drafts are
  welcome in the repository and are clearly marked as drafts until then. See
  [docs/START_HERE.md](docs/START_HERE.md) and [docs/RECOGNISABILITY.md](docs/RECOGNISABILITY.md).
- **Gameplay** changes must work in every city, not only the one you tested, and show it: a
  screenshot or short clip in the pull request.
- **Sources** are open or used with permission, and credited. Code is MIT; data and assets keep
  their own licences ([NOTICE.md](NOTICE.md)).

## Before big work

Open an issue or start a thread in Discord #ideas first. A short "here's what I want to try"
saves everyone a wasted weekend, and others may want to help.

## Reviews

Every change to `main` goes through a pull request that passes the tests and is approved by a
maintainer. We aim to:

- reply to a new pull request or issue within a week,
- be specific and kind: say what to change and why,
- merge or explain why not, instead of leaving work hanging.

## Becoming a maintainer

There is no application form. People who have had a few good pull requests merged and who help
review and answer others' questions are invited to become maintainers, for an area of the map or
for part of the engine. Maintainers can review and merge, and are listed in `CODEOWNERS`.

## Contributions and licences

By opening a pull request you agree that your code is released under the project's
[MIT licence](LICENSE), and that any data or assets you add come with a licence that allows them
here, recorded in [NOTICE.md](NOTICE.md). You keep the credit: Git records your authorship.

## Conduct

Everyone follows the [Code of Conduct](CODE_OF_CONDUCT.md). Report problems privately to a
maintainer, or security issues as described in [SECURITY.md](SECURITY.md).
