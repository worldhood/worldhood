# Community

| Where | What it's for |
| --- | --- |
| **GitHub Issues** | The to-do list: bugs, the [wishlist](IDEAS.md), area and city claims |
| **GitHub Discussions** | Questions, design ideas, show-and-tell; searchable and permanent |
| **[Discord](https://discord.gg/tajQMEYxe9)** | Live chat, sharing drives and screenshots, city channels, build-alongs |

Decisions are recorded on GitHub (issues, pull requests, discussions), not only in chat.

## Discord server setup

**Name:** Worldhood
**Icon:** the `o↗` brand mark

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
  #show-your-drive  screenshots and clips (link the ?city=&start= URL)
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

> **Welcome to Worldhood.** Open-world driving across the real world, built from open data.
> Build your own city into it.
>
> - **Play:** https://worldhood.org (try `?city=helsinki` or `?city=tampere`)
> - **Code:** https://github.com/worldhood/worldhood
> - **Build your city:** the playbook in `docs/BUILD_YOUR_CITY.md`; it takes about 10 minutes to
>   get a drivable city
> - **Pick a task:** the wishlist (issues labelled `idea`), or `good first issue`
>
> Say hi in #general: which city would you build?

### Rules (pin in #rules)

> 1. Be kind. We follow the Contributor Covenant (`CODE_OF_CONDUCT.md`).
> 2. Real places, real people: no content mocking or targeting real people, private homes or
>    sensitive sites.
> 3. Open data only. **Never share or use Google Street View, Google 3D tiles or other proprietary
>    map imagery** in the project. Look at them in their own viewers only.
> 4. Credit sources. Every city and asset says where it came from.
> 5. Decisions live on GitHub. Chat is for talking; open an issue or discussion for anything that
>    needs a decision.
> 6. No spam or self-promotion outside #show-your-drive.

### Moderation basics

- **AutoMod:** block spam links and slurs; new members must accept the rules before posting.
- **Slow mode** in busy channels during launches.
- **Two moderators in different time zones** before the public launch.
- Keep a short mod log in a private #mod-log channel.

### Useful integrations

- **GitHub feed:** post new releases and merged pull requests to #announcements via a webhook. In
  the repo, go to *Settings → Webhooks* and use the Discord webhook URL with `/github` appended.
- **Contributor role:** give it by hand at first; automate it later.
