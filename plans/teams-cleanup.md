# Teams Store Cleanup

Reference skill: `skill/zustand-store-pruning/SKILL.md`

## Summary

Shrink `shared/stores/teams.tsx` aggressively by removing service-backed convenience caches and route-owned UI state.

The end state is:

- chat and teams screens load current team data from the service through feature hooks
- route-local flows keep wizard, selection, and submit state locally
- engine listeners are only used for mounted-screen nudges or reload triggers
- the Zustand store either becomes very small or disappears entirely

Assumption for this plan: local service RPCs are cheap enough that we prefer reloading on mount/focus over keeping frontend caches warm.

## Guiding Rules

- Do not preserve a Zustand cache just to avoid a small number of local RPCs
- Prefer feature hooks such as `useTeam(...)`, `useTeamMembers(...)`, and `useTeamChannels(...)` over store selectors
- Prefer route params and local state over global wizard or modal state
- Prefer direct navigation from callers over teams-store navigation wrapper actions
- Do not introduce module-level mutable state as a replacement for Zustand
  - no module-level caches
  - no module-level listener registries
  - no module-level in-flight request maps
  - no module-level popup handler singletons
  - no module-level `useSyncExternalStore(...)` stores backed by module variables
  - if multiple mounted descendants need shared loaded data on one route, use a feature-local provider instead
- Keep behavior intact while changing ownership of state
- Slice-by-slice migrations must preserve current functionality; if mounted UI previously updated live while visible, move that update path into the new hook/provider/listener in the same slice instead of deferring it

## Chunk 1: Define Chat-Facing Data Hooks

- [x] Introduce a small chat-safe service layer for mounted consumers
  - `useChatTeam(teamID, teamname?)`
  - `useChatTeamMembers(teamID)`
  - `useChatTeamChannels(teamID, teamname?)`
- [x] Make these hooks own reload-on-mount/focus behavior instead of relying on warmed store caches
- [x] Keep outputs narrow and purpose-built for chat consumers
  - permissions / role for current user
  - member role lookup
  - current team metadata needed by chat
  - channel metadata for channel-management UI
- [x] Do not add a new hidden module-level cache; if multiple mounted descendants need shared data on one route, use a feature-local provider

### Target chat callers for Chunk 1

- [x] `chat/conversation/info-panel/*`
- [x] `chat/conversation/messages/*` team-role / bot / admin checks
- [x] `chat/create-channel/*`
- [x] `chat/conversation/input-area/suggestors/channels.tsx`

### Store fallout after Chunk 1

- `teamIDToMembers`
- `teamRoleMap`
- `channelInfo`
- `teamMeta` reads from chat
- `teamDetails` reads from chat
- `teamNameToID` / `teamnames` reads from chat
- `manageChatChannels`, `startAddMembersWizard`, `addTeamWithChosenChannels`, `loadTeamChannelList` call sites in chat

## Chunk 2: Remove Teams Route / Modal UI State

- [x] Move `newTeamWizard` state into the team wizard route stack
- [x] Move `addMembersWizard` state into the add-members route stack
  - [x] Remove the leftover `addMembersWizard.justFinished` store flag by carrying the post-invite UI state on the team route instead
- [x] Move `teamSelectedChannels`, `teamSelectedMembers`, and `channelSelectedMembers` into the owning screens / popups
- [x] Move `errorInEmailInvite` and `teamNameToLoadingInvites` into local invite screen state
- [x] Move `errorInAddToTeam`, `errorInEditMember`, and `errorInEditWelcomeMessage` into local screen state
  - [x] Move `errorInEditMember` into the owning member/edit-role UI
  - [x] Delete the dead `errorInEditWelcomeMessage` store path
  - [x] Move `errorInAddToTeam` into the remaining add-member UI
- [x] Replace invite-by-email and invite-by-contact submit actions with `C.useRPC(...)`
- [x] Delete the leftover invite-submit store actions plus the dead welcome-message cache
- [x] Replace remaining store-owned submit actions with `C.useRPC(...)` at the owning screens where possible
  - [x] Replace `editMembership` submit actions in `teams/common/selection-popup.tsx` and `teams/team/member/index.new.tsx`
  - [x] Replace route-owned `addToTeam` submit actions in `teams/team/member/index.new.tsx`, `teams/team/rows/invite-row/request.tsx`, and `teams/team/rows/empty-row.tsx`
  - [x] Replace remaining confirm-modal submit actions

### Files likely to move together

- [x] `teams/routes.tsx`
- [x] `teams/new-team/wizard/*`
- [x] `teams/add-members-wizard/*`
- [x] `teams/common/selection-popup.tsx`
- [x] `teams/confirm-modals/*`
- [x] `teams/invite-by-email.tsx`
- [x] `teams/invite-by-contact/*`

### Store fallout after Chunk 2

- `newTeamWizard`
- `addMembersWizard`
- `teamSelectedChannels`
- `teamSelectedMembers`
- `channelSelectedMembers`
- `teamsWithChosenChannels`
- `errorInAddToTeam`
- `errorInEditMember`
- `errorInEditWelcomeMessage`
- `errorInEmailInvite`
- `teamNameToLoadingInvites`

## Chunk 3: Remove Teams Screen Convenience Caches

- [x] Replace team list reads with a route-owned `useTeamsList(...)` loader
  - [x] Move teams-root header filter sizing in `teams/get-options.tsx` onto `useTeamsList()`
  - [x] Add a team-route `LoadedTeamsListProvider` so mounted descendants share one `useTeamsList()` reload instead of reading `teamMeta` from the store
  - [x] Move team-route subteam filtering/rows and the kick-out confirmation modal off direct `teamMeta` store reads onto `useTeamsList()`
- [x] Replace team details reads with a route-owned `useTeam(teamID)` loader
  - [x] Move team shell consumers (`team/index`, `team/tabs`, `team/new-header`, `team/settings-tab`, `team/menu-container`, `team-info`) onto a route-owned `useLoadedTeam(teamID)` hook/provider
  - [x] Move current-team modal/screen consumers (`delete-team`, `edit-team-description`, `new-team/wizard/add-subteam-members`, `invite-by-contact/team-invite-by-contacts.native`, `confirm-modals/really-leave-team`) onto `useLoadedTeam(teamID)`
  - [x] Move team-route helpers and row actions (`common/activity`, `common/channel-hooks`, `common/selection-popup`, `team/rows/invite-row/request`, `confirm-modals/confirm-kick-out`) off direct `teamMeta` / `teamDetails` reads where route loaders already exist
  - [x] Move remaining team-builder/avatar/confirm consumers (`team-building/list-body`, `profile/edit-avatar/hooks`, `profile/routes`, `add-members-wizard/confirm`) off direct `teamDetails` / `teamMeta` store reads onto `useLoadedTeam(teamID)`
- [x] Replace channel list reads with a route-owned `useLoadedTeamChannels(teamID, teamname?)` loader/provider
  - [x] Move `teams/team/index.tsx`, `teams/team/rows/channel-row/*`, `teams/common/selection-popup.tsx`, and `teams/channel/*` channel-header/list consumers off `channelInfo` reads
  - [x] Stop calling `loadTeamChannelList` from the team/channel route shells and channel edit/delete/remove flows that now rely on route reloads
- [ ] Replace welcome message, retention policy, members, activity, and team tree reads with feature hooks local to the owning screens
  - [x] Move activity-level reads in teams root/team/channel screens onto a route-local `ActivityLevelsProvider` instead of the teams store cache
  - [x] Move team retention policy load/save in `teams/team/settings-tab/retention` onto a local RPC-backed hook with mount/focus reloads
  - [x] Move mounted channel route member/detail consumers and current-team row consumers onto `useLoadedTeam(teamID)` when they only need the active route's team data
  - [x] Move `teams/team/member/index.new.tsx` team-tree memberships and last-activity reads off the teams store onto a route-local loader plus engine listeners
  - [x] Move chat member loads and standalone team-name lookups off `teamIDToMembers` / `teamNameToID` / `teamnames` store caches onto local feature hooks and `useTeamsList()`
- [ ] Reload on focus/mount instead of maintaining store subscriptions
  - [x] Remove the legacy team-route list/details subscriptions now that `useLoadedTeam(...)`, `useLoadedTeamChannels(...)`, and `useTeamsList()` own mounted reloads
  - [x] Remove the remaining popup-only `teams/subscriber.tsx` path by gating `useLoadedTeam(...)` with the mounted popup state
- [x] Replace teams-store navigation wrapper actions with direct router calls where the caller already knows the target
  - [x] Replace teams-screen create-team, create-subteam, and add-members entrypoints with direct `navigateAppend(...)` calls instead of teams-store wrappers
  - [x] Replace chat/git/people create-team entrypoints with direct `navigateAppend(...)` calls instead of `launchNewTeamWizardOrModal`
  - [x] Move the remaining create-team / show-team navigation helpers out of `stores/teams.tsx` and into feature-local team route helpers

### Teams screens to convert

- [x] `teams/container.tsx`
- [x] `teams/team/index.tsx`
- [x] `teams/team/settings-tab/*`
- [x] `teams/team/member/*`
- [x] `teams/team/rows/*`
- [x] `teams/channel/*`
- [x] `profile/showcase-team-offer.tsx`
- [x] `settings/chat.tsx`

### Store fallout after Chunk 3

- `teamMeta`
- `teamDetails`
- `teamIDToWelcomeMessage`
- `teamIDToRetentionPolicy`
- `activityLevels`
- `teamMemberToLastActivity`
- `teamMemberToTreeMemberships`
- `treeLoaderTeamIDToSparseMemberInfos`
- `teamIDToMembers`
- `channelInfo`
- `teamNameToID`
- `teamnames`

## Chunk 4: Remove Notification-Driven Teams Cache Maintenance

- [ ] Stop treating `teams` as a background cache owner
- [x] Move badge-derived team adornment state (`deletedTeams`, `newTeams`, `teamIDToResetUsers`) out of `stores/teams.tsx` into `stores/notifications.tsx`
- [x] Move gregor-derived per-team access request state (`newTeamRequests`) out of `stores/teams.tsx` into `stores/notifications.tsx`
- [ ] Convert mounted-screen-only reactions to direct listeners plus reload
  - [x] `chat.1.chatUi.chatShowManageChannels`
  - [x] `keybase.1.NotifyTeam.teamDeleted`
  - [x] `keybase.1.NotifyTeam.teamExit`
  - [x] `chat.1.NotifyChat.ChatWelcomeMessageLoaded`
- [ ] Re-evaluate remaining teams engine handlers after earlier chunks land
- [x] Delete dead subscription-count bookkeeping once no screen depends on warmed caches
- [x] Delete the remaining stale-bit bookkeeping once no screen depends on warmed caches
- [x] Delete dead teams-store bookkeeping that no screen reads (`sawChatBanner`, `sawSubteamsBanner`, `teamAccessRequestsPending`)

### Store fallout after Chunk 4

- `newTeamRequests`
- `teamMetaSubscribeCount`
- `teamDetailsSubscriptionCount`
- `teamMetaStale`
- `teamVersion`
- most or all of `dispatch.onEngineIncomingImpl`
- `teams/subscriber.tsx`

## Chunk 5: Decide What, If Anything, Stays In Zustand

- [ ] Review what remains in `shared/stores/teams.tsx`
- [x] Replace the remaining profile `teamRoleMap` reads with `useTeamsList()`-derived role/membership data
- [ ] Delete dead selectors, helpers, and tests
- [x] Delete dead teams-store retention/activity cache leftovers after the route-local migrations (`teamIDToRetentionPolicy`, `activityLevels`)
- [ ] If only a tiny action layer remains, move it into feature hooks and remove the store entirely
- [ ] If something must remain, document exactly why it needs app-wide lifetime

### Likely removals at the end

- `deletedTeams`
- `newTeamRequests`
- `newTeams`
- `teamIDToResetUsers`
- `teamAccessRequestsPending`
- `sawChatBanner`
- `sawSubteamsBanner`

## Validation

- [ ] Chat info panel still renders correct permissions, members, and bot state
- [ ] Chat message popup still computes pin/delete/kick permissions correctly
- [ ] Team and channel screens reload correctly on entry and after mutation
- [ ] Team wizard and add-members flows work without global store state
- [ ] Navigation flows previously using teams-store dispatch still work with direct router calls
- [ ] Engine-driven mounted-screen nudges still react while visible
- [ ] No new module-level mutable cache is introduced as a replacement for Zustand
