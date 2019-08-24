## Updating dependencies

Overarching goals:

- Staying fairly up to date so we don't have to do large migrations and build known technical debt
- Don't update too early and introduce serious bugs

Our process:

We'll have a tick-tock cadence aligned with our sprint planning.

- On the 'tick' we'll add a 1 point ticket to investigate the state of our dependencies and any new ones we might want to explore. Create notes in the JIRA ticket to discuss in the 'tock' meeting. Include react-native/desktop/ and the npm -g we do in npm-helpers postinstall hook. Use the `npm outdated` command to generate this list.
- On the 'tock' have a post-planning meeting to discuss the findings of the previous week's ticket. Make tickets to do the updating.

Types of dependencies and how they're generally treated:

- Small non-breaking updates:
  Largely invisible changes. Usually just update to latest. Large groups of these can be bundled.
  Example: lodash 1.2.3 -> 1.2.4
- Medium updates:
  Mostly try and see if it breaks the world. Update by itself if possible.
  Example: electron 1.0.1 -> 1.1.1
- Large updates:
  Significant core / toolchain changes. Make plans for how we can do this.
  Example: babel 5 -> 6. material-ui 14 -> 15
- New major updates:
  Might not be impactful to our code but a large set of changes that are newly being adopted. Might not be a big deal but might be worth waiting for early minor fixes.
  Example: lodash 1.2.3 -> 2.0.1 vs 2.0.0
