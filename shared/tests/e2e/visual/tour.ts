import * as T from '../shared/test-ids.ts'
import type {Mask, SetupStep, TourEntry} from './tour-types.ts'

// Tab names are the values in constants/tabs.tsx. Desktop shows eight tabs; phone shows people,
// chat, files, teams and settings.
//
// Capture never resets scroll position or a selected sub-tab, so every entry on a screen with
// sub-tabs selects its own (switchSubTab), and every entry on a thread that another entry scrolls
// scrolls to its own place (scrollIntoView).

const team = {teamID: {ref: 'teamID'}} as const
const short = {channel: 'e2e-short', ref: 'conversationIDKey'} as const
const kinds = {channel: 'e2e-kinds', ref: 'conversationIDKey'} as const
const followSuggestions: Mask = {reason: 'people feed follow suggestions, server-picked', testID: T.PEOPLE_FOLLOW_SUGGESTIONS}
const deviceLastUsed: Mask = {reason: 'device last-used time, server-pushed', testID: T.DEVICES_ROW_LAST_USED}
const devicePageLastUsed: Mask = {reason: 'device last-used time, server-pushed', testID: T.DEVICE_PAGE_LAST_USED}
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
type ModalOpts = {
  seal?: TourEntry['seal']
  tab?: string
  phone?: boolean
  // false for a modal only the phone opens
  desktop?: boolean
  masks?: TourEntry['masks']
  ready?: string
  setup?: TourEntry['setup']
}
const modal = (id: string, name: string, params: Params = {}, opts: ModalOpts = {}): Array<TourEntry> => {
  const append = {name, params}
  const base = {
    id: `modal/${id}`,
    seal: opts.seal ?? [],
    ...(opts.masks ? {masks: opts.masks} : {}),
    ...(opts.setup ? {setup: opts.setup} : {}),
  }
  return [
    ...(opts.desktop === false
      ? []
      : [{...base, nav: {append, tab: opts.tab ?? 'tabs.gitTab'}, platforms: ['desktop'] as const, ready: opts.ready ?? T.MODAL_CLOSE}]),
    ...(opts.phone
      ? [{...base, nav: {append, tab: opts.tab ?? 'tabs.settingsTab'}, platforms: ['phone'] as const, ready: opts.ready ?? T.MODAL_SCREEN}]
      : []),
  ]
}
const teamModal = (id: string, name: string, params: Params = team, opts: ModalOpts = {}) =>
  modal(id, name, params, {seal: ['teams'], tab: 'tabs.teamsTab', ...opts})

// The phone's info panel, its own route.
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

// Desktop's info panel opens beside the conversation from the header's info button; the driver
// closes it again on every reset to the chat tab.
const desktopInfoPanel = (
  id: string,
  channel: string,
  tabButton: string,
  ready: string,
  more: ReadonlyArray<SetupStep> = []
): TourEntry => ({
  id: `chat/info-panel${id}`,
  nav: {tab: 'tabs.chatTab', thread: {channel, ref: 'conversationIDKey'}},
  platforms: ['desktop'],
  ready,
  seal: ['inbox', 'teams'],
  setup: [
    {kind: 'openPopup', testID: T.CHAT_HEADER_INFO_BUTTON},
    {kind: 'switchSubTab', testID: tabButton},
    ...more,
  ],
})

// The attachments tab of e2e-media, which holds an image, two videos and a text file, on one of
// its Media / Docs / Links views. Desktop only: on the phone the sheet's top-right corner shadow
// draws one level off in one channel in the first capture of e2e-media's panel after another
// conversation's entry (aa), which no ready state settles.
const attachmentsView = (id: string, view: string, ready: string): TourEntry =>
  desktopInfoPanel(`-${id}`, 'e2e-media', T.CHAT_INFO_PANEL_ATTACHMENTS_TAB, ready, [{kind: 'switchSubTab', testID: view}])

// The team's restricted bot, from its install modal: what it can read, the edit screen (nothing
// is saved until its Save button), and that screen's channel picker. The permissions list waits
// for the bot's settings, and Edit settings stays disabled until they load, so the edit entries
// wait for the list (scrollIntoView) before pressing it.
const TEAM_BOT = 'bottender'
// The team wizards' state: a new team's (NewTeamWizard) and adding members to the e2e team's
// (AddMembersWizard), as the app makes them before anything is filled in.
const newTeam = {
  addYourself: true,
  description: '',
  isBig: false,
  name: '',
  open: false,
  openTeamJoinRole: 'reader',
  profileShowcase: false,
  teamType: 'friends',
} as const
const addMembers = {addingMembers: [], membersAlreadyInTeam: [], role: 'writer', teamID: {ref: 'teamID'}} as const
const teamBuilderServices = ['keybase', 'twitter', 'facebook', 'github', 'reddit', 'hackernews']
const featuredBots: Mask = {reason: 'featured bots, server-picked and server-ordered', testID: T.CHAT_BOT_SEARCH_RESULTS}
// A crypto operation's result as its output screen takes it; the phone pushes the screen once an
// operation finishes, desktop shows the same output beside the input.
const cryptoOutput = {
  bytesComplete: 0,
  bytesTotal: 0,
  errorMessage: '',
  inProgress: false,
  input: 'Hello from the visual gate.',
  inputType: 'text',
  output: 'BEGIN KEYBASE SALTPACK MESSAGE. kiNJamlTJ7PqxyP HMpzfDiAlgM3Uv0 END KEYBASE SALTPACK MESSAGE.',
  outputSenderUsername: {ref: 'username'},
  outputSigned: true,
  outputStatus: 'success',
  outputType: 'text',
  outputValid: true,
  warningMessage: '',
} as const
const botInstall = {botUsername: TEAM_BOT, conversationIDKey: short}
const waitForBotPerms: SetupStep = {kind: 'scrollIntoView', testID: T.CHAT_BOT_PERMS}
const editBot: SetupStep = {kind: 'openPopup', testID: T.CHAT_BOT_EDIT_BUTTON}

// A crypto page: on desktop a sub-tab of the crypto tab, on phone a page pushed from the crypto list
// in settings.
const cryptoTab = (id: string, nav: string, ready: string): Array<TourEntry> => [
  {
    id: `crypto/${id}`,
    nav: {tab: 'tabs.cryptoTab'},
    platforms: ['desktop'],
    ready,
    seal: [],
    setup: [{kind: 'switchSubTab', testID: nav}],
  },
  {
    id: `crypto/${id}`,
    nav: {append: {name: `${id}Tab`, params: {}}, tab: 'tabs.settingsTab'},
    platforms: ['phone'],
    ready,
    seal: [],
  },
]

export const tour: ReadonlyArray<TourEntry> = [
  {
    id: 'tab/people',
    masks: [followSuggestions],
    nav: {tab: 'tabs.peopleTab'},
    platforms: ['desktop', 'phone'],
    ready: T.PEOPLE_FEED,
    seal: ['follows'],
  },
  // The inbox: the phone's chat tab root. Desktop has no inbox screen of its own (see the notes at
  // the bottom).
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
  // One message of each kind the CLI can make: a pinned message (and the pinned banner above the
  // thread), reactions, a reply, links with and without an unfurl, a giphy, a coin flip, a bot
  // command and a git push. The banner loads apart from the thread, so setup waits for it. A
  // desktop thread keeps its scroll position, so this one scrolls back to the git push, the newest
  // message, after chat/e2e-kinds-older.
  {
    id: 'chat/e2e-kinds',
    nav: {tab: 'tabs.chatTab', thread: kinds},
    platforms: ['desktop', 'phone'],
    ready: T.CHAT_GIT_PUSH,
    seal: ['inbox'],
    setup: [
      {kind: 'scrollIntoView', testID: T.CHAT_PINNED_BANNER},
      {kind: 'scrollIntoView', testID: T.CHAT_GIT_PUSH},
    ],
  },
  // The same thread scrolled up to its older half: the pinned message, the reactions, the reply,
  // the plain link and the giphy.
  {
    id: 'chat/e2e-kinds-older',
    nav: {tab: 'tabs.chatTab', thread: kinds},
    platforms: ['desktop', 'phone'],
    ready: T.CHAT_REACTIONS_ROW,
    seal: ['inbox'],
    setup: [
      {kind: 'scrollIntoView', testID: T.CHAT_PINNED_BANNER},
      {kind: 'scrollIntoView', testID: T.CHAT_REACTIONS_ROW},
    ],
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
    platforms: ['desktop', 'phone'],
    ready: T.CHAT_ATTACHMENT_FULLSCREEN,
    seal: ['inbox'],
    setup: [{kind: 'openPopup', testID: T.CHAT_ATTACHMENT_IMAGE}],
  },
  desktopInfoPanel('', 'e2e-short', T.CHAT_INFO_PANEL_MEMBERS_TAB, T.CHAT_INFO_PANEL),
  desktopInfoPanel('-attachments', 'e2e-short', T.CHAT_INFO_PANEL_ATTACHMENTS_TAB, T.CHAT_INFO_PANEL_MEDIA),
  desktopInfoPanel('-settings', 'e2e-short', T.CHAT_INFO_PANEL_SETTINGS_TAB, T.CHAT_INFO_PANEL),
  desktopInfoPanel('-bots', 'e2e-short', T.CHAT_INFO_PANEL_BOTS_TAB, T.CHAT_BOT_ROW),
  // leaves its menu open (leavesPopup); chat/info-panel-media opens another conversation
  {
    ...desktopInfoPanel('-menu', 'e2e-short', T.CHAT_INFO_PANEL_MEMBERS_TAB, T.FLOATING_MENU, [
      {kind: 'openPopup', testID: T.CHAT_INFO_PANEL_MENU_BUTTON},
    ]),
    leavesPopup: true,
  },
  // a channel with a description, which the panel's header shows
  desktopInfoPanel('-kinds', 'e2e-kinds', T.CHAT_INFO_PANEL_MEMBERS_TAB, T.CHAT_INFO_PANEL),
  attachmentsView('media', T.CHAT_INFO_PANEL_MEDIA, T.CHAT_INFO_PANEL_MEDIA),
  attachmentsView('docs', T.CHAT_INFO_PANEL_DOCS, T.CHAT_INFO_PANEL_DOCS),
  attachmentsView('links', T.CHAT_INFO_PANEL_LINKS, T.CHAT_INFO_PANEL_LINKS),
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
    id: 'files/missing',
    nav: {append: {name: 'fsBrowse', params: {path: {ref: 'privateFolder', sub: 'visual-gate-missing'}}}, tab: 'tabs.fsTab'},
    platforms: ['desktop', 'phone'],
    ready: T.FILES_OOPS,
    seal: ['kbfsPrivate'],
  },
  {
    id: 'files/private',
    nav: {append: {name: 'fsBrowse', params: {path: {ref: 'privateFolder'}}}, tab: 'tabs.fsTab'},
    platforms: ['desktop', 'phone'],
    ready: T.FILES_BROWSER,
    seal: ['kbfsPrivate'],
  },
  {
    id: 'files/text',
    nav: {append: {name: 'fsBrowse', params: {path: {ref: 'privateFolder', sub: 'test.txt'}}}, tab: 'tabs.fsTab'},
    platforms: ['desktop', 'phone'],
    ready: T.FILES_TEXT_PREVIEW,
    seal: ['kbfsPrivate'],
  },
  ...cryptoTab('encrypt', T.CRYPTO_NAV_ENCRYPT, T.CRYPTO_ENCRYPT_INPUT),
  ...cryptoTab('decrypt', T.CRYPTO_NAV_DECRYPT, T.CRYPTO_DECRYPT_INPUT),
  ...cryptoTab('sign', T.CRYPTO_NAV_SIGN, T.CRYPTO_SIGN_INPUT),
  ...cryptoTab('verify', T.CRYPTO_NAV_VERIFY, T.CRYPTO_VERIFY_INPUT),
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
  teamTab('subteams', T.TEAMS_TAB_SUBTEAMS_BUTTON, T.TEAMS_SUBTEAMS_TAB),
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
  // the member's team row expanded: last activity and the channels they're in
  {
    id: 'team/member-self-expanded',
    nav: {append: {name: 'teamMember', params: {...team, username: {ref: 'username'}}}, tab: 'tabs.teamsTab'},
    platforms: ['desktop', 'phone'],
    ready: T.TEAMS_MEMBER_TEAM_ACTIVITY,
    seal: ['teams', 'inbox'],
    setup: [{kind: 'openPopup', testID: T.TEAMS_MEMBER_TEAM_EXPAND}],
  },
  // Git, devices and crypto are tabs on desktop and pages in the phone's settings list.
  {
    id: 'tab/git',
    nav: {tab: 'tabs.gitTab'},
    platforms: ['desktop'],
    ready: T.GIT_REPO_LIST,
    seal: [],
  },
  phoneSettingsPage('tab/git', 'gitTab', T.GIT_REPO_LIST, []),
  {
    id: 'tab/devices',
    masks: [deviceLastUsed],
    nav: {tab: 'tabs.devicesTab'},
    platforms: ['desktop'],
    ready: T.DEVICES_LIST,
    seal: ['devices'],
  },
  {...phoneSettingsPage('tab/devices', 'devicesTab', T.DEVICES_LIST, ['devices']), masks: [deviceLastUsed]},
  {
    id: 'devices/page',
    masks: [devicePageLastUsed],
    nav: {tab: 'tabs.devicesTab'},
    platforms: ['desktop'],
    ready: T.DEVICE_PAGE,
    seal: ['devices'],
    setup: [{kind: 'openPopup', testID: T.DEVICES_ROW}],
  },
  {
    ...phoneSettingsPage('devices/page', 'devicesTab', T.DEVICE_PAGE, ['devices']),
    masks: [devicePageLastUsed],
    setup: [{kind: 'openPopup', testID: T.DEVICES_ROW}],
  },
  // the phone's crypto list; desktop has none (its crypto tab opens on encrypt beside the same list)
  phoneSettingsPage('tab/crypto', 'cryptoTab', T.CRYPTO_INPUT, []),
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
  ...settingsPage('icons', 'iconsTab', T.SETTINGS_ROW_ICONS, T.SETTINGS_ICONS),
  ...settingsPage('wallet', 'walletsTab', T.SETTINGS_ROW_WALLET, T.SETTINGS_WALLET),
  // The settings list: the phone's settings tab root. Desktop's sits beside a sub-page, always the
  // same one here, as settings/account captures it.
  {
    id: 'tab/settings',
    nav: {tab: 'tabs.settingsTab'},
    platforms: ['phone'],
    ready: T.SETTINGS_ACCOUNT,
    seal: [],
  },
  {
    id: 'tab/settings',
    nav: {tab: 'tabs.settingsTab'},
    platforms: ['desktop'],
    ready: T.SETTINGS_ACCOUNT_PAGE,
    seal: [],
    setup: [{kind: 'switchSubTab', testID: T.SETTINGS_ROW_ACCOUNT}],
  },
  ...modal('device-add', 'deviceAdd', {}, {phone: true, ready: T.DEVICES_ADD_DEVICE}),
  ...modal('add-email', 'settingsAddEmail', {}, {phone: true}),
  ...modal('add-phone', 'settingsAddPhone', {}, {phone: true}),
  ...modal('kext-permission', 'kextPermission'),
  ...teamModal('team-edit-info', 'teamEditTeamInfo', team, {phone: true}),
  ...teamModal('team-edit-description', 'teamEditTeamDescription', team, {phone: true}),
  ...modal('backup-files', 'archiveModal', {type: 'fsAll'}, {phone: true}),
  ...modal('backup-repos', 'archiveModal', {type: 'gitAll'}, {phone: true}),
  ...modal('backup-repo', 'archiveModal', {gitURL: 'keybase://team/testteam/repo', type: 'git'}, {phone: true}),
  ...modal('profile-proofs', 'profileProofsList', {}, {phone: true}),
  ...modal('git-new-team-repo', 'gitNewRepo', {isTeam: true}, {phone: true, seal: ['teams']}),
  ...modal('profile-pgp', 'profilePgp', {}, {phone: true}),
  ...modal('profile-avatar', 'profileEditAvatar'),
  ...modal('profile-showcase-teams', 'profileShowcaseTeamOffer', {}, {phone: true, seal: ['teams']}),
  ...modal('profile-add-to-team', 'profileAddToTeam', {username: {ref: 'secondUser'}}, {phone: true, seal: ['teams']}),
  ...modal('people-builder', 'peopleTeamBuilder', {}, {masks: [teamBuilderRecs], phone: true, seal: ['follows']}),
  ...modal('feedback', 'signupSendFeedbackLoggedIn', {}, {phone: true}),
  ...modal('chat-block', 'chatBlockingModal', {blockUserByDefault: true, username: {ref: 'secondUser'}}, {phone: true, seal: ['follows']}),
  ...teamModal('team-rename', 'teamRename', {teamname: {ref: 'teamname'}}, {phone: true}),
  ...teamModal('team-delete', 'teamDeleteTeam', team, {phone: true}),
  ...teamModal('team-leave', 'teamReallyLeaveTeam', team, {phone: true}),
  ...teamModal('team-invite-email', 'teamInviteByEmail', team, {phone: true}),
  ...teamModal('team-add-to-channels', 'teamAddToChannels', team, {phone: true, seal: ['teams', 'inbox']}),
  ...teamModal('team-add-emoji', 'teamAddEmoji', {...team, conversationIDKey: short}, {phone: true, seal: ['teams', 'inbox']}),
  ...teamModal('team-add-alias', 'teamAddEmojiAlias', {conversationIDKey: short}, {phone: true, seal: ['teams', 'inbox']}),
  ...teamModal('chat-create-channel', 'chatCreateChannel', team, {phone: true}),
  ...teamModal('bot-installed', 'chatInstallBot', botInstall, {phone: true, ready: T.CHAT_BOT_PERMS, seal: ['teams', 'inbox']}),
  ...teamModal('bot-edit', 'chatInstallBot', botInstall, {
    phone: true,
    ready: T.CHAT_BOT_CHANNELS_DROPDOWN,
    seal: ['teams', 'inbox'],
    setup: [waitForBotPerms, editBot],
  }),
  ...teamModal('bot-channels', 'chatInstallBot', botInstall, {
    phone: true,
    ready: T.CHAT_BOT_CHANNEL_PICKER,
    seal: ['teams', 'inbox'],
    setup: [waitForBotPerms, editBot, {kind: 'openPopup', testID: T.CHAT_BOT_CHANNELS_DROPDOWN}],
  }),
  ...teamModal('chat-delete-history', 'chatDeleteHistoryWarning', {conversationIDKey: short}, {phone: true, seal: ['inbox']}),
  ...teamModal('team-remove-member', 'teamReallyRemoveMember', {...team, members: [{ref: 'secondUser'}]}, {phone: true}),
  ...teamModal(
    'team-remove-channel-member',
    'teamReallyRemoveChannelMember',
    {...team, conversationIDKey: short, members: [{ref: 'secondUser'}]},
    {phone: true, seal: ['teams', 'inbox']}
  ),
  ...teamModal('team-delete-channel', 'teamDeleteChannel', {...team, conversationIDKey: short}, {phone: true, seal: ['teams', 'inbox']}),
  ...teamModal('team-open-warning', 'openTeamWarning', {isOpenTeam: false, teamname: {ref: 'teamname'}}, {phone: true}),
  ...teamModal(
    'team-retention-warning',
    'retentionWarning',
    {entityType: 'big team', policy: {seconds: 604800, title: '7 days', type: 'expire'}},
    {phone: true}
  ),
  ...teamModal('team-contact-restricted', 'contactRestricted', {source: 'teamAddAllFailed', usernames: [{ref: 'secondUser'}]}, {phone: true}),
  ...teamModal(
    'team-builder',
    'teamsTeamBuilder',
    {...team, addMembersWizard: addMembers, filterServices: teamBuilderServices, goButtonLabel: 'Add', namespace: 'teams', title: ''},
    {masks: [teamBuilderRecs], phone: true, seal: ['teams', 'follows']}
  ),
  ...teamModal('team-create-channels', 'teamCreateChannels', team, {phone: true}),
  ...teamModal(
    'team-edit-channel',
    'teamEditChannel',
    {...team, channelname: 'e2e-short', conversationIDKey: short, description: 'A channel description'},
    {phone: true, seal: ['teams', 'inbox']}
  ),
  ...teamModal('team-wizard-purpose', 'teamWizard1TeamPurpose', {wizard: newTeam}, {phone: true}),
  ...teamModal('team-wizard-info', 'teamWizard2TeamInfo', {wizard: newTeam}, {phone: true}),
  ...teamModal('team-wizard-size', 'teamWizard4TeamSize', {wizard: newTeam}, {phone: true}),
  ...teamModal('team-wizard-channels', 'teamWizard5Channels', {wizard: {...newTeam, isBig: true}}, {phone: true}),
  ...teamModal('team-wizard-subteams', 'teamWizard6Subteams', {wizard: {...newTeam, isBig: true}}, {phone: true}),
  ...teamModal(
    'team-wizard-subteam-members',
    'teamWizardSubteamMembers',
    {wizard: {...newTeam, name: 'sub', parentTeamID: {ref: 'teamID'}, teamType: 'subteam'}},
    {phone: true}
  ),
  ...teamModal('team-add-from-where', 'teamAddToTeamFromWhere', {wizard: addMembers}, {phone: true}),
  ...teamModal('team-add-email', 'teamAddToTeamEmail', {wizard: addMembers}, {phone: true}),
  ...teamModal('team-add-phone', 'teamAddToTeamPhone', {wizard: addMembers}, {phone: true}),
  ...teamModal(
    'team-add-confirm',
    'teamAddToTeamConfirm',
    {wizard: {...addMembers, addingMembers: [{assertion: 'visualgate@example.com', role: 'writer'}]}},
    {phone: true}
  ),
  ...teamModal('team-new', 'teamNewTeamDialog', {}, {phone: true}),
  ...teamModal('team-new-subteam', 'teamNewTeamDialog', {subteamOf: {ref: 'teamID'}}, {phone: true}),
  ...teamModal('team-join', 'teamJoinTeamDialog', {}, {phone: true}),
  ...teamModal('team-join-sent', 'teamJoinTeamDialog', {success: true}, {phone: true}),
  ...teamModal(
    'team-invite-link',
    'teamInviteLinkJoin',
    {
      inviteDetails: {
        inviteID: 'visualgate',
        inviterResetOrDel: false,
        inviterUID: '',
        inviterUsername: {ref: 'secondUser'},
        isMember: false,
        teamAvatars: null,
        teamDesc: 'A team description',
        teamID: {ref: 'teamID'},
        teamIsOpen: false,
        teamName: {parts: [{ref: 'teamname'}]},
        teamNumMembers: 3,
      },
      inviteKey: 'visualgate',
    },
    {phone: true}
  ),
  ...modal(
    'chat-navigate-external',
    'chatConfirmNavigateExternal',
    {display: 'https://exаmple.com', punycode: 'https://xn--exmple-4nf.com', url: 'https://xn--exmple-4nf.com'},
    {phone: true}
  ),
  ...teamModal('chat-remove-bot', 'chatConfirmRemoveBot', {...team, botUsername: TEAM_BOT, conversationIDKey: short}, {
    phone: true,
    seal: ['teams', 'inbox'],
  }),
  ...teamModal('chat-search-bots', 'chatSearchBots', {...team, conversationIDKey: short}, {
    masks: [featuredBots],
    phone: true,
    ready: T.CHAT_BOT_SEARCH_RESULTS,
    seal: ['teams', 'inbox'],
  }),
  ...modal('chat-install-bot-pick', 'chatInstallBotPick', {botUsername: TEAM_BOT}, {phone: true, seal: ['teams', 'inbox']}),
  // the destination picker only; the message it would forward is never shown
  ...modal('chat-forward', 'chatForwardMsgPick', {conversationIDKey: short, messageID: 1}, {phone: true, seal: ['teams', 'inbox']}),
  ...modal('chat-send-to-chat', 'chatSendToChat', {sendPaths: [{ref: 'privateFolder', sub: 'test.txt'}]}, {
    phone: true,
    seal: ['teams', 'inbox'],
  }),
  // The services leave out 'phone': with it the phone shows a contacts banner whose effect can save
  // the address book to the server.
  ...modal('chat-new-chat', 'chatNewChat', {filterServices: teamBuilderServices, namespace: 'chat', title: 'New chat'}, {
    masks: [teamBuilderRecs],
    phone: true,
    seal: ['follows'],
  }),
  ...modal(
    'crypto-builder',
    'cryptoTeamBuilder',
    {filterServices: teamBuilderServices, goButtonLabel: 'Add', namespace: 'crypto', recommendedHideYourself: true, teamBuilderNonce: 'visual', title: 'Recipients'},
    {masks: [teamBuilderRecs], phone: true, seal: ['follows']}
  ),
  // a file the title step only names: nothing is uploaded until Send
  ...modal(
    'chat-attachment-titles',
    'chatAttachmentGetTitles',
    {conversationIDKey: short, pathAndOutboxIDs: [{path: '/visual-gate/report.pdf'}]},
    {phone: true, seal: ['inbox']}
  ),
  ...modal('chat-pdf', 'chatPDF', {conversationIDKey: short, messageID: 1}, {phone: true, seal: ['inbox']}),
  ...modal('chat-new-team', 'chatShowNewTeamDialog', {conversationIDKey: short}, {phone: true, seal: ['inbox']}),
  ...teamModal('chat-add-to-channel', 'chatAddToChannel', {...team, conversationIDKey: short}, {phone: true, seal: ['teams', 'inbox']}),
  {
    id: 'chat/enter-paper-key',
    nav: {append: {name: 'chatEnterPaperkey', params: {}}, tab: 'tabs.chatTab'},
    platforms: ['desktop', 'phone'],
    ready: T.PAPER_KEY_FORM,
    seal: [],
  },
  ...modal('crypto-encrypt-output', 'encryptOutput', {...cryptoOutput, hasRecipients: true, includeSelf: true, recipients: [{ref: 'secondUser'}]}, {
    desktop: false,
    phone: true,
    ready: T.CRYPTO_OUTPUT,
  }),
  ...modal('crypto-decrypt-output', 'decryptOutput', cryptoOutput, {desktop: false, phone: true, ready: T.CRYPTO_OUTPUT}),
  ...modal('crypto-sign-output', 'signOutput', cryptoOutput, {desktop: false, phone: true, ready: T.CRYPTO_OUTPUT}),
  ...modal('crypto-verify-output', 'verifyOutput', {...cryptoOutput, output: 'Hello from the visual gate.'}, {
    desktop: false,
    phone: true,
    ready: T.CRYPTO_OUTPUT,
  }),
  {
    id: 'team/external',
    nav: {append: {name: 'teamExternalTeam', params: {teamname: {ref: 'teamname'}}}, tab: 'tabs.teamsTab'},
    platforms: ['desktop', 'phone'],
    ready: T.TEAMS_EXTERNAL_TEAM,
    seal: ['teams'],
  },
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
//   chatAddToChannel, chatConfirmRemoveBot, chatForwardMsgPick, chatInstallBotPick,
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
// is not in), and the message kinds no seeded channel holds (exploding, payments, journey cards,
// audio and location; the CLI can't send the last two)
//
// Mount nothing the tour doesn't already: gitNewRepo for a personal repo, teamCreateChannels, chatMessagePopup and
// fsFilePreview (the preview files/text reaches through fsBrowse, as a click on a file does), chatNewChat,
// cryptoTeamBuilder and teamsTeamBuilder (the same builder as modal/people-builder)
//
// Edit forms change nothing until saved, so the tour opens them, except teamEditChannel (it takes
// the channel's current name and description as params, which no ParamRef supplies) and
// profileEdit: its fields fill in from a profile load that holds no waiting key, so the first open
// after a launch shows the placeholders and every later one the values.
//
// One screen, one id: an entry that's a tab on one platform and a page on the other keeps the tab's
// id on both (tab/git, tab/devices, tab/settings). Two phone roots have no desktop screen of their
// own. tab/crypto is the phone's crypto list; desktop's crypto tab opens on crypto/encrypt beside
// the same list. tab/chat is the phone's inbox; desktop's sits beside a conversation, so every
// desktop chat entry captures it. A desktop tab/chat entry would be one of those again, and the
// first chat entry of a session can't be one: until its conversation loads, the conversation the
// app opened at launch satisfies ready (aa: 2 of 4 pairs differ).
//
// Platform or build: settingsTabs.cryptoTab, settingsTabs.devicesTab and settingsTabs.gitTab are
// tablet-only sub-tabs on desktop (desktop has them as tabs); settingsTabs.contactsTab and
// accountSwitcher are phone screens with nothing to wait on (contacts also needs the OS
// permission); makeIcons is a developer tool; kextPermission is macOS only. Desktop-only entries
// for screens the phone also has: chat/message-react and chat/message-menu (the phone opens them
// with a long press, which setup can't do), chat/thread-search (below), and chat/info-panel-media,
// -docs, -links and files/team (their notes), settings/screen-protector (the phone lists it on
// Android only; iOS shows a one-line notice with no testID), and modal/profile-avatar (the phone
// opens the system photo picker over it). Not in the main window: the menubar, the tracker popup and the
// unlock-folders window are separate desktop windows; global errors and runtime stats are debug
// overlays.
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
//   archiveModal of a folder (type fsPath): the folder's info line spins without end for the
//     empty team folder.
