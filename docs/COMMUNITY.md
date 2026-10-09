# Community

| Where | What it's for |
| --- | --- |
| **[GitHub Issues](https://github.com/worldhood/worldhood/issues)** | Bugs, ideas, the [wishlist](IDEAS.md), and coordinating work on places and the engine |
| **[Discord](https://discord.gg/tajQMEYxe9)** | Live chat, screenshots and build-alongs |

Record decisions in GitHub issues and pull requests so contributors can find them later. GitHub Discussions is not currently enabled.

## Suggested Discord server setup

This is a setup proposal, not a list of channels or roles that already exist.

**Name:** worldhood
**Icon:** the globe with its highlighted place

### Roles

| Role | Who | Can |
| --- | --- | --- |
| Maintainer | Engine maintainers | Manage channels, pin, moderate |
| City lead | Maintainer of a city (listed in `cities/<id>/city.json`) | Pin in their city channel |
| Contributor | Anyone with a merged pull request | Coloured name; thank-you |
| Member | Everyone who accepted the rules | Post everywhere except announcements |

### Channels

```
INFO
  #welcome          read-only: what this is, links, how to start
  #rules            read-only: code of conduct summary
  #announcements    read-only: releases, new cities, events
COMMUNITY
  #general
  #show-your-hood   screenshots and clips (link the ?city=&start= URL)
  #ideas            discuss before opening an issue
  #help             setup and "how do I…" questions
BUILD
  #city-builders    building and refining cities, data, OpenStreetMap
  #engine-dev       engine, rendering, performance
  #gameplay         weather, sound, vehicles, missions
  #landmarks        modelling famous buildings
  #data-licensing   sources, attribution, what's allowed
CITIES              one channel per city with a lead
  #helsinki
  #tampere
VOICE
  🔊 build-along
```

### Welcome message (pin in #welcome)

> **Welcome to worldhood.** Check out some hoods. Then build your own.
> Explore real places by car, on foot, by bicycle or scooter. Help build a corner of the world,
> improve the shared game engine, or tell us what could work better.
>
> - **Play:** https://worldhood.org (try `?city=helsinki` or `?city=tampere`)
> - **Code:** https://github.com/worldhood/worldhood
> - **Build a place:** start with `docs/BUILD_YOUR_CITY.md`; a street or landmark is welcome too
> - **Improve the engine:** see `docs/GAMEPLAY.md` for the shared systems
> - **The vision:** `docs/VISION.md` explains what works today and where we want to go
> - **Pick a task:** the wishlist (issues labelled `idea`), or `good first issue`
>
> Say hi in #general: which city would you build?

### Rules (pin in #rules)

> 1. Be kind. We follow the Contributor Covenant (`CODE_OF_CONDUCT.md`).
> 2. Real places, real people: no content mocking or targeting real people, private homes or
>    sensitive sites.
> 3. Open data only. **Never share or use Google Street View, Google 3D tiles or other proprietary
>    map imagery** in project assets or datasets. Public access does not grant permission to
>    copy or trace a source; use sources whose terms permit the work you are contributing.
> 4. Credit sources. Every city and asset says where it came from.
> 5. Decisions live on GitHub. Chat is for talking; open an issue for anything that
>    needs a decision.
> 6. No spam or unrelated self-promotion.

### Moderation basics

- **AutoMod:** block spam links and slurs; new members must accept the rules before posting.
- **Slow mode** in busy channels during launches.
- **Two moderators in different time zones** before the public launch.
- Keep a short mod log in a private #mod-log channel.

### Useful integrations

- **GitHub feed:** post new releases and merged pull requests to #announcements via a webhook. In
  the repo, go to *Settings → Webhooks* and use the Discord webhook URL with `/github` appended.
- **Contributor role:** give it by hand at first; automate it later.
