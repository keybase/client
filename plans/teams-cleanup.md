# Teams Store Cleanup

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

- [ ] `chat/conversation/info-panel/*`
- [x] `chat/conversation/messages/*` team-role / bot / admin checks
- [ ] `chat/create-channel/*`
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

- [ ] Move `newTeamWizard` state into the team wizard route stack
- [ ] Move `addMembersWizard` state into the add-members route stack
- [ ] Move `teamSelectedChannels`, `teamSelectedMembers`, and `channelSelectedMembers` into the owning screens / popups
- [ ] Move `errorInAddToTeam`, `errorInEditMember`, `errorInEditWelcomeMessage`, `errorInEmailInvite`, and `teamNameToLoadingInvites` into local screen state
- [ ] Replace store-owned submit actions with `C.useRPC(...)` at the owning screens where possible

### Files likely to move together

- [ ] `teams/routes.tsx`
- [ ] `teams/new-team/wizard/*`
- [ ] `teams/add-members-wizard/*`
- [ ] `teams/common/selection-popup.tsx`
- [ ] `teams/confirm-modals/*`
- [ ] `teams/invite-by-email.tsx`
- [ ] `teams/invite-by-contact/*`

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

- [ ] Replace team list reads with a route-owned `useTeamsList(...)` loader
- [ ] Replace team details reads with a route-owned `useTeam(teamID)` loader
- [ ] Replace welcome message, retention policy, members, activity, and team tree reads with feature hooks local to the owning screens
- [ ] Reload on focus/mount instead of maintaining store subscriptions
- [ ] Replace teams-store navigation wrapper actions with direct router calls where the caller already knows the target

### Teams screens to convert

- [ ] `teams/container.tsx`
- [ ] `teams/team/index.tsx`
- [ ] `teams/team/settings-tab/*`
- [ ] `teams/team/member/*`
- [ ] `teams/team/rows/*`
- [ ] `teams/channel/*`
- [ ] `profile/showcase-team-offer.tsx`
- [ ] `settings/chat.tsx`

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
- [ ] Convert mounted-screen-only reactions to direct listeners plus reload
  - `chat.1.chatUi.chatShowManageChannels`
  - `keybase.1.NotifyTeam.teamDeleted`
  - `keybase.1.NotifyTeam.teamExit`
  - `chat.1.NotifyChat.ChatWelcomeMessageLoaded`
- [ ] Re-evaluate remaining teams engine handlers after earlier chunks land
- [ ] Delete subscription-count and stale-bit bookkeeping once no screen depends on warmed caches

### Store fallout after Chunk 4

- `teamMetaSubscribeCount`
- `teamDetailsSubscriptionCount`
- `teamMetaStale`
- `teamVersion`
- most or all of `dispatch.onEngineIncomingImpl`
- `teams/subscriber.tsx`

## Chunk 5: Decide What, If Anything, Stays In Zustand

- [ ] Review what remains in `shared/stores/teams.tsx`
- [ ] Delete dead selectors, helpers, and tests
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
