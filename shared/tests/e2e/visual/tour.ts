import * as T from '../shared/test-ids.ts'
import type {Mask, TourEntry} from './tour-types.ts'

// Tab names are the values in constants/tabs.tsx. Desktop shows eight tabs; phone shows people,
// chat, files, teams and settings.
//
// Capture never resets scroll position or a selected sub-tab, so every entry on a screen with
// sub-tabs selects its own (switchSubTab), and nothing here scrolls.

const team = {teamID: {ref: 'teamID'}} as const
const short = {channel: 'e2e-short', ref: 'conversationIDKey'} as const
const followSuggestions: Mask = {reason: 'people feed follow suggestions, server-picked', testID: T.PEOPLE_FOLLOW_SUGGESTIONS}
const deviceLastUsed: Mask = {reason: 'device last-used time, server-pushed', testID: T.DEVICES_ROW_LAST_USED}
const teamBuilderRecs: Mask = {reason: 'team builder recommendations, server-picked and server-ordered', testID: T.TEAM_BUILDING_RECS}

// A settings sub-page: on desktop a sub-tab of the settings tab, on phone a page pushed from the
// settings list.
const settingsPage = (id: string, route: string, row: string, ready: string): Array<TourEntry> => [
  {
    id: `settings/${id}`,
    nav: {tab: 'tabs.settingsTab'},
    platforms: ['desktop'],
    ready,
    seal: [],
    setup: [{kind: 'switchSubTab', testID: row}],
  },
  {
    id: `settings/${id}`,
    nav: {append: {name: `settingsTabs.${route}`, params: {}}, tab: 'tabs.settingsTab'},
    platforms: ['phone'],
    ready,
    seal: [],
  },
]

// Pages the phone reaches from its settings list that desktop has as tabs of their own.
const phoneSettingsPage = (id: string, route: string, ready: string, seal: TourEntry['seal']): TourEntry => ({
  id,
  nav: {append: {name: `settingsTabs.${route}`, params: {}}, tab: 'tabs.settingsTab'},
  platforms: ['phone'],
  ready,
  seal,
})

const teamTab = (id: string, button: string, ready: string): TourEntry => ({
  id: `team/${id}`,
  nav: {append: {name: 'team', params: team}, tab: 'tabs.teamsTab'},
  platforms: ['desktop', 'phone'],
  ready,
  seal: ['teams'],
  setup: [{kind: 'switchSubTab', testID: button}],
})

// A modal that only shows something: it changes nothing until a button in it is pressed, which the
// tour never does. On desktop those that aren't a team's open over the git tab, whose list holds
// nothing that changes on its own: behind a modal, settings would show whichever sub-tab an earlier
// entry left selected, chat whichever conversation, and the devices list carries live last-used
// times. A phone modal covers the whole screen.
type Params = NonNullable<TourEntry['nav']['append']>['params']
type ModalOpts = {seal?: TourEntry['seal']; tab?: string; phone?: boolean; masks?: TourEntry['masks']; ready?: string}
const modal = (id: string, name: string, params: Params = {}, opts: ModalOpts = {}): Array<TourEntry> => {
  const append = {name, params}
  const base = {id: `modal/${id}`, seal: opts.seal ?? [], ...(opts.masks ? {masks: opts.masks} : {})}
  return [
    {...base, nav: {append, tab: opts.tab ?? 'tabs.gitTab'}, platforms: ['desktop'], ready: opts.ready ?? T.MODAL_CLOSE},
    ...(opts.phone
      ? [{...base, nav: {append, tab: opts.tab ?? 'tabs.settingsTab'}, platforms: ['phone'] as const, ready: opts.ready ?? T.MODAL_SCREEN}]
      : []),
  ]
}
const teamModal = (id: string, name: string, params: Params = team, opts: ModalOpts = {}) =>
  modal(id, name, params, {seal: ['teams'], tab: 'tabs.teamsTab', ...opts})

// The phone's info panel, its own route. Desktop's is left out (see the exclusions below).
const infoPanel = (tab: string, channel: string): TourEntry => ({
  id: `chat/info-panel-${tab}`,
  nav: {
    append: {name: 'chatInfoPanel', params: {conversationIDKey: {channel, ref: 'conversationIDKey'}, tab}},
    tab: 'tabs.chatTab',
  },
  platforms: ['phone'],
  ready: T.CHAT_INFO_PANEL,
  seal: ['inbox', 'teams'],
})

const cryptoTab = (id: string, nav: string, ready: string): TourEntry => ({
  id: `crypto/${id}`,
  nav: {tab: 'tabs.cryptoTab'},
  platforms: ['desktop'],
  ready,
  seal: [],
  setup: [{kind: 'switchSubTab', testID: nav}],
})

export const tour: ReadonlyArray<TourEntry> = [
  {
    id: 'tab/people',
    masks: [followSuggestions],
    nav: {tab: 'tabs.peopleTab'},
    platforms: ['desktop', 'phone'],
    ready: T.PEOPLE_FEED,
    seal: ['follows'],
  },
  {
    id: 'tab/chat',
    nav: {tab: 'tabs.chatTab'},
    platforms: ['phone'],
    ready: T.CHAT_INBOX_LIST,
    seal: ['inbox'],
  },
  {
    id: 'chat/e2e-short',
    nav: {tab: 'tabs.chatTab', thread: {channel: 'e2e-short', ref: 'conversationIDKey'}},
    platforms: ['desktop', 'phone'],
    ready: T.CHAT_MESSAGE_LIST,
    seal: ['inbox'],
  },
  {
    id: 'chat/e2e-media',
    nav: {tab: 'tabs.chatTab', thread: {channel: 'e2e-media', ref: 'conversationIDKey'}},
    platforms: ['desktop', 'phone'],
    ready: T.CHAT_MESSAGE_LIST,
    seal: ['inbox'],
  },
  // The hover bar and the ... menu of e2e-media's image. The menu leaves its popup open
  // (leavesPopup), so the entry after it opens another conversation; with the popup open, hovering
  // the row draws no hover bar.
  {
    id: 'chat/message-react',
    nav: {tab: 'tabs.chatTab', thread: {channel: 'e2e-media', ref: 'conversationIDKey'}},
    platforms: ['desktop'],
    ready: T.CHAT_EMOJI_PICKER,
    seal: ['inbox'],
    setup: [
      {kind: 'hover', testID: T.CHAT_ATTACHMENT_IMAGE},
      {kind: 'openPopup', testID: T.CHAT_MESSAGE_REACT_BUTTON},
    ],
  },
  {
    id: 'chat/message-menu',
    nav: {tab: 'tabs.chatTab', thread: {channel: 'e2e-media', ref: 'conversationIDKey'}},
    platforms: ['desktop'],
    ready: T.FLOATING_MENU,
    seal: ['inbox'],
    setup: [
      {kind: 'hover', testID: T.CHAT_ATTACHMENT_IMAGE},
      {kind: 'openPopup', testID: T.CHAT_MESSAGE_MENU_BUTTON},
    ],
    leavesPopup: true,
  },
  {
    id: 'chat/thread-search',
    nav: {tab: 'tabs.chatTab', thread: {channel: 'e2e-long', ref: 'conversationIDKey'}},
    platforms: ['desktop'],
    ready: T.CHAT_THREAD_SEARCH,
    seal: ['inbox'],
    setup: [{kind: 'openPopup', testID: T.CHAT_HEADER_SEARCH_BUTTON}],
  },
  {
    id: 'chat/attachment-fullscreen',
    nav: {tab: 'tabs.chatTab', thread: {channel: 'e2e-media', ref: 'conversationIDKey'}},
    platforms: ['desktop'],
    ready: T.CHAT_ATTACHMENT_FULLSCREEN,
    seal: ['inbox'],
    setup: [{kind: 'openPopup', testID: T.CHAT_ATTACHMENT_IMAGE}],
  },
  {...infoPanel('members', 'e2e-short'), id: 'chat/info-panel'},
  infoPanel('attachments', 'e2e-short'),
  infoPanel('settings', 'e2e-short'),
  infoPanel('bots', 'e2e-short'),
  {
    ...infoPanel('members', 'e2e-short'),
    id: 'chat/info-panel-menu',
    setup: [{kind: 'openPopup', testID: T.CHAT_INFO_PANEL_MENU_BUTTON}],
  },
  {
    id: 'tab/fs',
    nav: {tab: 'tabs.fsTab'},
    platforms: ['desktop', 'phone'],
    ready: T.FILES_BROWSER,
    seal: ['kbfs'],
  },
  {
    id: 'files/team',
    nav: {append: {name: 'fsBrowse', params: {path: {ref: 'teamFolder'}}}, tab: 'tabs.fsTab'},
    platforms: ['desktop'],
    ready: T.FILES_BROWSER,
    seal: ['kbfs'],
  },
  {
    id: 'files/private',
    nav: {append: {name: 'fsBrowse', params: {path: {ref: 'privateFolder'}}}, tab: 'tabs.fsTab'},
    platforms: ['desktop', 'phone'],
    ready: T.FILES_BROWSER,
    seal: ['kbfsPrivate'],
  },
  cryptoTab('encrypt', T.CRYPTO_NAV_ENCRYPT, T.CRYPTO_ENCRYPT_INPUT),
  cryptoTab('decrypt', T.CRYPTO_NAV_DECRYPT, T.CRYPTO_DECRYPT_INPUT),
  cryptoTab('sign', T.CRYPTO_NAV_SIGN, T.CRYPTO_SIGN_INPUT),
  cryptoTab('verify', T.CRYPTO_NAV_VERIFY, T.CRYPTO_VERIFY_INPUT),
  {
    id: 'tab/teams',
    nav: {tab: 'tabs.teamsTab'},
    platforms: ['desktop', 'phone'],
    ready: T.TEAMS_LIST,
    seal: ['teams'],
  },
  teamTab('members', T.TEAMS_TAB_MEMBERS_BUTTON, T.TEAMS_MEMBER_LIST),
  teamTab('channels', T.TEAMS_TAB_CHANNELS_BUTTON, T.TEAMS_CHANNEL_LIST),
  teamTab('emoji', T.TEAMS_TAB_EMOJI_BUTTON, T.TEAMS_EMOJI_TAB),
  teamTab('settings', T.TEAMS_TAB_SETTINGS_BUTTON, T.TEAMS_SETTINGS_TAB),
  teamTab('bots', T.TEAMS_TAB_BOTS_BUTTON, T.TEAMS_BOTS_TAB),
  // team/menu leaves its popup open (leavesPopup), so another teams entry follows it.
  {
    id: 'team/member-add-role',
    nav: {append: {name: 'teamMember', params: {...team, username: {ref: 'secondUser'}}}, tab: 'tabs.teamsTab'},
    platforms: ['desktop', 'phone'],
    ready: T.TEAMS_ROLE_PICKER,
    seal: ['teams'],
    setup: [{kind: 'openPopup', testID: T.TEAMS_MEMBER_ADD_TO_TEAM_BUTTON}],
  },
  {
    id: 'team/menu',
    nav: {append: {name: 'team', params: team}, tab: 'tabs.teamsTab'},
    platforms: ['desktop'],
    ready: T.FLOATING_MENU,
    seal: ['teams'],
    setup: [
      {kind: 'switchSubTab', testID: T.TEAMS_TAB_MEMBERS_BUTTON},
      {kind: 'openPopup', testID: T.TEAMS_HEADER_MENU_BUTTON},
    ],
    leavesPopup: true,
  },
  // A phone menu is a bottom sheet whose container is a single accessibility element, so nothing
  // inside it can be waited on: ready is the screen under it, and settle waits out the sheet.
  {
    id: 'team/menu',
    nav: {append: {name: 'team', params: team}, tab: 'tabs.teamsTab'},
    platforms: ['phone'],
    ready: T.TEAMS_MEMBER_LIST,
    seal: ['teams'],
    setup: [
      {kind: 'switchSubTab', testID: T.TEAMS_TAB_MEMBERS_BUTTON},
      {kind: 'openPopup', testID: T.TEAMS_HEADER_MENU_BUTTON},
    ],
  },
  {
    id: 'team/channel',
    nav: {
      append: {name: 'teamChannel', params: {...team, conversationIDKey: {channel: 'e2e-short', ref: 'conversationIDKey'}}},
      tab: 'tabs.teamsTab',
    },
    platforms: ['desktop', 'phone'],
    ready: T.TEAMS_CHANNEL_PAGE,
    seal: ['teams', 'inbox'],
  },
  {
    id: 'team/member-self',
    nav: {append: {name: 'teamMember', params: {...team, username: {ref: 'username'}}}, tab: 'tabs.teamsTab'},
    platforms: ['desktop', 'phone'],
    ready: T.TEAMS_MEMBER_PAGE,
    seal: ['teams'],
  },
  {
    id: 'tab/git',
    nav: {tab: 'tabs.gitTab'},
    platforms: ['desktop'],
    ready: T.GIT_REPO_LIST,
    seal: [],
  },
  {
    id: 'tab/devices',
    masks: [deviceLastUsed],
    nav: {tab: 'tabs.devicesTab'},
    platforms: ['desktop'],
    ready: T.DEVICES_LIST,
    seal: ['devices'],
  },
  {
    id: 'devices/page',
    masks: [{reason: 'device last-used time, server-pushed', testID: T.DEVICE_PAGE_LAST_USED}],
    nav: {tab: 'tabs.devicesTab'},
    platforms: ['desktop'],
    ready: T.DEVICE_PAGE,
    seal: ['devices'],
    setup: [{kind: 'openPopup', testID: T.DEVICES_ROW}],
  },
  ...settingsPage('account', 'accountTab', T.SETTINGS_ROW_ACCOUNT, T.SETTINGS_ACCOUNT_PAGE),
  ...settingsPage('advanced', 'advancedTab', T.SETTINGS_ROW_ADVANCED, T.SETTINGS_ADVANCED),
  ...settingsPage('backup', 'archiveTab', T.SETTINGS_ROW_ARCHIVE, T.SETTINGS_ARCHIVE),
  ...settingsPage('chat', 'chatTab', T.SETTINGS_ROW_CHAT, T.SETTINGS_CHAT),
  ...settingsPage('display', 'displayTab', T.SETTINGS_ROW_DISPLAY, T.SETTINGS_DISPLAY),
  ...settingsPage('feedback', 'feedbackTab', T.SETTINGS_ROW_FEEDBACK, T.SETTINGS_FEEDBACK),
  ...settingsPage('files', 'fsTab', T.SETTINGS_ROW_FILES, T.SETTINGS_FILES),
  ...settingsPage('notifications', 'notificationsTab', T.SETTINGS_ROW_NOTIFICATIONS, T.SETTINGS_NOTIFICATIONS),
  ...settingsPage('typography', 'typographyTab', T.SETTINGS_ROW_TYPOGRAPHY, T.SETTINGS_TYPOGRAPHY),
  ...settingsPage('markdown', 'markdownTab', T.SETTINGS_ROW_MARKDOWN, T.SETTINGS_MARKDOWN),
  ...settingsPage('about', 'aboutTab', T.SETTINGS_ROW_ABOUT, T.SETTINGS_ABOUT),
  {
    id: 'settings/screen-protector',
    nav: {tab: 'tabs.settingsTab'},
    platforms: ['desktop'],
    ready: T.SETTINGS_SCREENPROTECTOR,
    seal: [],
    setup: [{kind: 'switchSubTab', testID: T.SETTINGS_ROW_SCREENPROTECTOR}],
  },
  {
    id: 'settings/icons',
    nav: {tab: 'tabs.settingsTab'},
    platforms: ['desktop'],
    ready: T.SETTINGS_ICONS,
    seal: [],
    setup: [{kind: 'switchSubTab', testID: T.SETTINGS_ROW_ICONS}],
  },
  {
    id: 'settings/wallet',
    nav: {tab: 'tabs.settingsTab'},
    platforms: ['desktop'],
    ready: T.SETTINGS_WALLET,
    seal: [],
    setup: [{kind: 'switchSubTab', testID: T.SETTINGS_ROW_WALLET}],
  },
  {...phoneSettingsPage('settings/devices', 'devicesTab', T.DEVICES_LIST, ['devices']), masks: [deviceLastUsed]},
  phoneSettingsPage('settings/git', 'gitTab', T.GIT_REPO_LIST, []),
  phoneSettingsPage('settings/crypto', 'cryptoTab', T.CRYPTO_INPUT, []),
  {
    id: 'tab/settings',
    nav: {tab: 'tabs.settingsTab'},
    platforms: ['phone'],
    ready: T.SETTINGS_ACCOUNT,
    seal: [],
  },
  ...modal('device-add', 'deviceAdd'),
  ...modal('add-email', 'settingsAddEmail'),
  ...modal('add-phone', 'settingsAddPhone'),
  ...modal('kext-permission', 'kextPermission'),
  ...teamModal('team-edit-info', 'teamEditTeamInfo', team, {phone: true}),
  ...teamModal('team-edit-description', 'teamEditTeamDescription', team, {phone: true}),
  ...modal('backup-files', 'archiveModal', {type: 'fsAll'}, {phone: true}),
  ...modal('backup-repos', 'archiveModal', {type: 'gitAll'}, {phone: true}),
  ...modal('backup-repo', 'archiveModal', {gitURL: 'keybase://team/testteam/repo', type: 'git'}),
  ...modal('profile-proofs', 'profileProofsList'),
  ...modal('profile-pgp', 'profilePgp', {}, {phone: true}),
  ...modal('profile-avatar', 'profileEditAvatar'),
  ...modal('profile-showcase-teams', 'profileShowcaseTeamOffer', {}, {phone: true, seal: ['teams']}),
  ...modal('profile-add-to-team', 'profileAddToTeam', {username: {ref: 'secondUser'}}, {phone: true, seal: ['teams']}),
  ...modal('people-builder', 'peopleTeamBuilder', {}, {masks: [teamBuilderRecs], phone: true, seal: ['follows']}),
  ...modal('feedback', 'signupSendFeedbackLoggedIn', {}, {phone: true}),
  ...modal('chat-block', 'chatBlockingModal', {blockUserByDefault: true, username: {ref: 'secondUser'}}, {phone: true, seal: ['follows']}),
  ...teamModal('team-rename', 'teamRename', {teamname: {ref: 'teamname'}}, {phone: true}),
  ...teamModal('team-delete', 'teamDeleteTeam'),
  ...teamModal('team-leave', 'teamReallyLeaveTeam', team, {phone: true}),
  ...teamModal('team-invite-email', 'teamInviteByEmail', team, {phone: true}),
  ...teamModal('team-add-to-channels', 'teamAddToChannels', team, {phone: true, seal: ['teams', 'inbox']}),
  ...teamModal('team-add-emoji', 'teamAddEmoji', {...team, conversationIDKey: short}, {seal: ['teams', 'inbox']}),
  ...teamModal('team-add-alias', 'teamAddEmojiAlias', {conversationIDKey: short}, {phone: true, seal: ['teams', 'inbox']}),
  ...teamModal('chat-create-channel', 'chatCreateChannel'),
  ...teamModal('chat-delete-history', 'chatDeleteHistoryWarning', {conversationIDKey: short}, {phone: true, seal: ['inbox']}),
  ...modal(
    'chat-emoji',
    'chatChooseEmoji',
    {conversationIDKey: short, pickKey: 'reaction'},
    {phone: true, ready: T.CHAT_EMOJI_PICKER, seal: ['inbox']}
  ),
]

// Routes from `yarn visual:routes` the tour leaves out, and why.
//
// Signed out, provisioning or resetting (the gate runs signed in): login, feedback,
//   recoverPassword*, reset*, proxySettingsModal, signupError, signupEnter*,
//   signupSendFeedbackLoggedOut, signupVerifyPhoneNumber, and the provision screens
//
// Reached only through a write, or a form whose state no ParamRef can supply:
//   chatAddToChannel, chatConfirmRemoveBot, chatForwardMsgPick, chatInstallBot, chatInstallBotPick,
//   chatSendToChat, chatShowNewTeamDialog, chatEnterPaperkey (rekey), devicePaperKey (makes a
//   paper key on open), deviceRevoke, confirmDelete, destinationPicker, gitDeleteRepo,
//   gitSelectChannel, incomingShareNew (an OS share), profileImport, profileRevoke,
//   checkPassphraseBeforeDeleteAccount, dbNukeConfirm, deleteConfirm, settingsTabs.password,
//   settingsTabs.logOutTab, settingsPushPrompt, settingsContactsJoined, settingsVerifyPhone,
//   settingsDeleteAddress, contactRestricted, openTeamWarning, retentionWarning, teamAddToTeam*
//   and teamWizard* (their params are the wizard's state object), teamDeleteChannel,
//   teamInviteByContact (needs the contacts permission), teamInviteLinkJoin, teamJoinTeamDialog,
//   teamNewTeamDialog, teamReallyRemove* (an array param), reallyRemoveAccount, removeAccount
//
// Need a specific message, file or output the account doesn't hold, or that only a typed input
// produces (setup steps can't type): chatAttachmentGetTitles, chatPDF, chatLocationPreview,
// chatUnfurlMapPopup, chatConfirmNavigateExternal, decryptOutput, encryptOutput, signOutput,
// verifyOutput, keybaseLinkError, webLinks (an external page), teamExternalTeam (a team the account
// is not in), team subteams tab (the team has none), and the message kinds no seeded channel holds
// (coin flips, exploding, payments, git pushes, pins, replies, reactions, journey cards, unfurls)
//
// Mount nothing the tour doesn't already: gitNewRepo, teamCreateChannels, chatMessagePopup and
// fsFilePreview (images and PDFs; the private folder holds no text file), chatNewChat,
// cryptoTeamBuilder and teamsTeamBuilder (the same builder as modal/people-builder)
//
// Edit forms change nothing until saved, so the tour opens them, except teamEditChannel (it takes
// the channel's current name and description as params, which no ParamRef supplies) and
// profileEdit: its fields fill in from a profile load that holds no waiting key, so the first open
// after a launch shows the placeholders and every later one the values.
//
// Covered inside other entries: desktop's chat root is the inbox beside a conversation, so the
// chat/e2e-short and chat/e2e-media entries capture the desktop inbox (a separate tab/chat entry
// would show whichever conversation an earlier entry selected); tab/settings is settings/account on
// desktop, tab/crypto is crypto/encrypt.
//
// Platform or build: settingsTabs.cryptoTab, settingsTabs.devicesTab and settingsTabs.gitTab are
// tablet-only sub-tabs on desktop (desktop has them as tabs); settingsTabs.contactsTab and
// accountSwitcher are phone screens with nothing to wait on (contacts also needs the OS
// permission); makeIcons is a developer tool; kextPermission, the modal add email/phone/device
// entries and the settings sub-pages without a phone testID are desktop only; the phone's
// add-email/phone/device, proofs list and team delete modals mount nothing the tour doesn't
// already. Not in the main window: the menubar, the tracker popup and the unlock-folders window
// are separate desktop windows; global errors and runtime stats are debug overlays.
//
// Thread search on phone: its button is a native header bar item with no testID.
//
// Unstable, not masked:
//   profile (self and others): reopening a profile within 30s of closing it shows an empty profile
//     with spinning follower counts that never fill in (tracker/identify-session.tsx: the closed
//     profile's session is dropped, and the 30s recheck window then skips the reload). Seen in
//     real time too, and the same on master. The tour opens every entry twice, and with Date
//     frozen the window never ends, so the second capture is always the empty one.
//   phone files/team: in some app launches the first time the folder is pushed, its header's
//     "..." button draws its dots 1px off from every later push (327 px; seen in 5 of 8 rounds,
//     always the first push of the launch). Native header layout, not data; no ready state to
//     wait for. Desktop captures it.
//   desktop chat info panel: it opens by setting infoPanel on the chat root's params, which
//     navigateToThread merges rather than clears, so it would stay open for the conversation
//     entries captured after it. The phone's info panel is its own route and is in the tour.
//   archiveModal of a folder (type fsPath): the folder's info line spins without end for the
//     empty team folder.
