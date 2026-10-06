import * as T from '../shared/test-ids.ts'
import type {ParamValue, SetupStep, TourEntry} from './tour-types.ts'

// Tab names are the values in constants/tabs.tsx. Desktop shows eight tabs; phone shows people,
// chat, files, teams and settings.
//
// Capture never resets scroll position or a selected sub-tab, so every entry on a screen with
// sub-tabs selects its own (switchSubTab), and every entry on a thread that another entry scrolls
// scrolls to its own place (scrollIntoView).

const team = {teamID: {ref: 'teamID'}} as const
const short = {channel: 'e2e-short', ref: 'conversationIDKey'} as const
const kinds = {channel: 'e2e-kinds', ref: 'conversationIDKey'} as const

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
  fixture?: TourEntry['fixture']
  ready?: string
  setup?: TourEntry['setup']
}
const modal = (id: string, name: string, params: Params = {}, opts: ModalOpts = {}): Array<TourEntry> => {
  const append = {name, params}
  const base = {
    id: `modal/${id}`,
    seal: opts.seal ?? [],
    ...(opts.fixture ? {fixture: opts.fixture} : {}),
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

// The app's other windows (desktop/remote), captured instead of the main window, which sits on the
// git tab behind them. Each opens for its capture and closes after it.
const pinentryArg = {
  cancelLabel: 'Cancel',
  prompt: 'Please enter the Keybase password for testuser (8+ characters)',
  showTyping: {allow: true, defaultValue: false, label: 'Show typing', readonly: true},
  submitLabel: 'Submit',
  type: 2, // PassphraseType.passPhrase
  windowTitle: 'Keybase password',
}
const pinentry = (id: string, props: Record<string, ParamValue>): TourEntry => ({
  id: `window/pinentry${id}`,
  nav: {tab: 'tabs.gitTab'},
  platforms: ['desktop'],
  ready: T.PINENTRY,
  seal: [],
  window: {component: 'pinentry', props, size: {height: 230, width: 440}},
})
const unlockFolders = {
  component: 'unlock-folders',
  props: {
    devices: [
      {deviceID: 'visual-gate-1', name: 'work-laptop', type: 'desktop'},
      {deviceID: 'visual-gate-2', name: 'phone', type: 'mobile'},
      {deviceID: 'visual-gate-3', name: 'paper key', type: 'backup'},
    ],
    paperKeyError: '',
    waiting: false,
  },
  size: {height: 300, width: 500},
} as const
const menubar = {component: 'menubar', size: {height: 640, width: 360}} as const
const windows: Array<TourEntry> = [
  // The tray widget: the inbox's widget conversations and the account's recent file edits. Its
  // nav badges are the main window's tab badges.
  {
    id: 'window/menubar',
    nav: {tab: 'tabs.gitTab'},
    platforms: ['desktop'],
    ready: T.MENUBAR_TLF_ROW,
    seal: ['inbox', 'follows', 'fsHistory'],
    window: menubar,
  },
  {
    id: 'window/menubar-menu',
    nav: {tab: 'tabs.gitTab'},
    platforms: ['desktop'],
    ready: T.FLOATING_MENU,
    seal: ['inbox', 'follows', 'fsHistory'],
    setup: [{kind: 'openPopup', testID: T.MENUBAR_MENU_BUTTON}],
    window: menubar,
  },
  // The tracker popup, as profile/self and profile/other show the same people.
  ...(['secondUser', 'username'] as const).map(
    (ref): TourEntry => ({
      id: `window/tracker-${ref === 'username' ? 'self' : 'other'}`,
      nav: {tab: 'tabs.gitTab'},
      platforms: ['desktop'],
      ready: T.TRACKER_BUTTONS,
      seal: ['follows', 'teams'],
      window: {component: 'tracker', reason: 'You opened a private folder with this user', size: {height: 470, width: 320}, username: {ref}},
    })
  ),
  // Pinentry's props are the service's GUIEntryArg (go/libkb/passphrase_helper.go).
  pinentry('', pinentryArg),
  pinentry('-retry', {...pinentryArg, retryLabel: 'Incorrect password.'}),
  pinentry('-paper-key', {
    cancelLabel: 'Cancel',
    prompt: "Please enter the paper key 'example words...'",
    submitLabel: 'Submit',
    type: 1, // PassphraseType.paperKey
    windowTitle: 'Paper Key',
  }),
  {
    id: 'window/unlock-folders',
    nav: {tab: 'tabs.gitTab'},
    platforms: ['desktop'],
    ready: T.UNLOCK_FOLDERS_DEVICES,
    seal: [],
    window: unlockFolders,
  },
  // its paper key step is the window's own state, a click away
  {
    id: 'window/unlock-folders-paper-key',
    nav: {tab: 'tabs.gitTab'},
    platforms: ['desktop'],
    ready: T.UNLOCK_FOLDERS_PAPER_KEY_INPUT,
    seal: [],
    setup: [{kind: 'switchSubTab', testID: T.UNLOCK_FOLDERS_PAPER_KEY_BUTTON}],
    window: unlockFolders,
  },
]

// Entries under a dev-only fixture (fixtures/): server-picked content the fixture replaces, so it
// is compared instead of masked. They run after every live entry (fixtureOrderProblems).
const recs = {name: 'team-builder-recs'} as const
const fixtureEntries: Array<TourEntry> = [
  {
    fixture: {args: {users: [{ref: 'secondUser'}, 'vg-ada', 'vg-ben']}, name: 'people-follow-suggestions'},
    id: 'tab/people',
    nav: {tab: 'tabs.peopleTab'},
    platforms: ['desktop', 'phone'],
    ready: T.PEOPLE_FOLLOW_SUGGESTION,
    seal: ['follows'],
  },
  {
    fixture: {name: 'device-last-used'},
    id: 'tab/devices',
    nav: {tab: 'tabs.devicesTab'},
    platforms: ['desktop'],
    ready: T.DEVICES_ROW_LAST_USED,
    seal: ['devices'],
  },
  {
    ...phoneSettingsPage('tab/devices', 'devicesTab', T.DEVICES_ROW_LAST_USED, ['devices']),
    fixture: {name: 'device-last-used'},
  },
  {
    fixture: {name: 'device-last-used'},
    id: 'devices/page',
    nav: {tab: 'tabs.devicesTab'},
    platforms: ['desktop'],
    ready: T.DEVICE_PAGE_LAST_USED,
    seal: ['devices'],
    setup: [{kind: 'openPopup', testID: T.DEVICES_ROW}],
  },
  {
    ...phoneSettingsPage('devices/page', 'devicesTab', T.DEVICE_PAGE_LAST_USED, ['devices']),
    fixture: {name: 'device-last-used'},
    setup: [{kind: 'openPopup', testID: T.DEVICES_ROW}],
  },
  // the params the people tab's search opens it with (appendPeopleBuilder)
  ...modal(
    'people-builder',
    'peopleTeamBuilder',
    {filterServices: ['facebook', 'github', 'hackernews', 'keybase', 'reddit', 'twitter'], namespace: 'people', title: ''},
    {fixture: recs, phone: true, ready: T.TEAM_BUILDING_RESULT_ROW, seal: ['follows']}
  ),
  ...teamModal(
    'team-builder',
    'teamsTeamBuilder',
    {...team, addMembersWizard: addMembers, filterServices: teamBuilderServices, goButtonLabel: 'Add', namespace: 'teams', title: ''},
    {fixture: recs, phone: true, ready: T.TEAM_BUILDING_RESULT_ROW, seal: ['teams', 'follows']}
  ),
  ...teamModal('chat-search-bots', 'chatSearchBots', {...team, conversationIDKey: short}, {
    fixture: {args: {bots: [TEAM_BOT, 'vg-helper-bot']}, name: 'featured-bots'},
    phone: true,
    ready: T.CHAT_BOT_ROW,
    seal: ['teams', 'inbox'],
  }),
  // The services leave out 'phone': with it the phone shows a contacts banner whose effect can save
  // the address book to the server.
  ...modal('chat-new-chat', 'chatNewChat', {filterServices: teamBuilderServices, namespace: 'chat', title: 'New chat'}, {
    fixture: recs,
    phone: true,
    ready: T.TEAM_BUILDING_RESULT_ROW,
    seal: ['follows'],
  }),
  ...modal(
    'crypto-builder',
    'cryptoTeamBuilder',
    {filterServices: teamBuilderServices, goButtonLabel: 'Add', namespace: 'crypto', recommendedHideYourself: true, teamBuilderNonce: 'visual', title: 'Recipients'},
    {fixture: recs, phone: true, ready: T.TEAM_BUILDING_RESULT_ROW, seal: ['follows']}
  ),
]

export const tour: ReadonlyArray<TourEntry> = [
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
  // Who reacted, in the tooltip a reaction shows on hover.
  {
    id: 'chat/reaction-tooltip',
    nav: {tab: 'tabs.chatTab', thread: kinds},
    platforms: ['desktop'],
    ready: T.CHAT_REACTION_TOOLTIP,
    seal: ['inbox'],
    setup: [
      {kind: 'scrollIntoView', testID: T.CHAT_PINNED_BANNER},
      {kind: 'scrollIntoView', testID: T.CHAT_REACTIONS_ROW},
      {kind: 'hover', testID: T.CHAT_REACTION_ITEM},
    ],
  },
  // The prompt the pinned banner's close button asks before unpinning (the account pinned the
  // message, so it asks). Desktop leaves the prompt open (leavesPopup): chat/message-react opens
  // another conversation. On the phone the prompt is a bottom sheet, so ready is the banner.
  ...(['desktop', 'phone'] as const).map(
    (platform): TourEntry => ({
      id: 'chat/unpin-prompt',
      nav: {tab: 'tabs.chatTab', thread: kinds},
      platforms: [platform],
      ready: platform === 'desktop' ? T.CHAT_UNPIN_PROMPT : T.CHAT_PINNED_BANNER,
      seal: ['inbox'],
      setup: [
        {kind: 'scrollIntoView', testID: T.CHAT_PINNED_BANNER},
        {kind: 'click', testID: T.CHAT_PINNED_UNPIN},
      ],
      ...(platform === 'desktop' ? {leavesPopup: true as const} : {}),
    })
  ),
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
  // Thread search run on a word no message holds: its "No results" count. A word with a hit
  // centres the thread on it, and opening that same search again (the next capture) leaves the
  // thread at its top instead, every other time.
  {
    id: 'chat/thread-search-no-results',
    nav: {tab: 'tabs.chatTab', thread: short},
    platforms: ['desktop', 'phone'],
    ready: T.CHAT_THREAD_SEARCH_STATUS,
    seal: ['inbox'],
    setup: [{kind: 'searchThread', query: 'visualgatenomatch'}],
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
  // a channel with a description, which the panel's header shows
  {...infoPanel('members', 'e2e-kinds'), id: 'chat/info-panel-kinds'},
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
  // a folder the account can't read: the second account's private folder
  {
    id: 'files/no-access',
    nav: {append: {name: 'fsBrowse', params: {path: {ref: 'otherPrivateFolder'}}}, tab: 'tabs.fsTab'},
    platforms: ['desktop', 'phone'],
    ready: T.FILES_OOPS,
    seal: [],
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
  // A member selected, and the bulk actions bar that shows for it. Desktop only: on the phone the
  // bar renders through a portal outside the team's selection provider and throws
  // (TeamSelectionProvider missing).
  {
    ...teamTab('members-selected', T.TEAMS_TAB_MEMBERS_BUTTON, T.TEAMS_SELECTION_POPUP),
    platforms: ['desktop'],
    setup: [
      {kind: 'switchSubTab', testID: T.TEAMS_TAB_MEMBERS_BUTTON},
      {kind: 'click', testID: T.TEAMS_MEMBER_CHECK},
    ],
  },
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
  // iOS lists no row for it (it shows a notice that only Android supports it), but the route opens
  phoneSettingsPage('settings/screen-protector', 'screenprotector', T.SETTINGS_SCREENPROTECTOR, []),
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
  ...modal('profile-edit', 'profileEdit', {}, {phone: true}),
  // A profile: the second account's, and the smoke account's own. Teams in common and the
  // followers come from the seal's teams and follows. On the phone the rim of the glass back
  // button over the colored header draws a level or two off depending on how the keyboard has come
  // and gone in the sitting: an aa of only these and modal/profile-edit (its first field
  // autofocuses) differs between its two passes, while with the keyboard modals before them in the
  // tour it is stable. Scope a phone run of them from modal/add-email.
  ...(['secondUser', 'username'] as const).map(
    (ref): TourEntry => ({
      id: `profile/${ref === 'username' ? 'self' : 'other'}`,
      nav: {append: {name: 'profile', params: {username: {ref}}}, tab: 'tabs.peopleTab'},
      platforms: ['desktop', 'phone'],
      ready: T.PROFILE_PAGE,
      seal: ['follows', 'teams'],
    })
  ),
  // One contact who is on Keybase, the second account, which the smoke account does not follow.
  ...modal(
    'settings-contacts-joined',
    'settingsContactsJoined',
    {
      contacts: [
        {
          assertion: {ref: 'secondUser'},
          component: {email: 'visualgate@example.com', label: 'home'},
          contactIndex: 0,
          contactName: 'Visual Gate',
          displayLabel: 'visualgate@example.com',
          displayName: 'Visual Gate',
          following: false,
          fullName: '',
          resolved: true,
          uid: '',
          username: {ref: 'secondUser'},
        },
      ],
    },
    {phone: true, seal: ['follows']}
  ),
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
  ...modal('chat-install-bot-pick', 'chatInstallBotPick', {botUsername: TEAM_BOT}, {phone: true, seal: ['teams', 'inbox']}),
  // the destination picker only; the message it would forward is never shown
  ...modal('chat-forward', 'chatForwardMsgPick', {conversationIDKey: short, messageID: 1}, {phone: true, seal: ['teams', 'inbox']}),
  ...modal('chat-send-to-chat', 'chatSendToChat', {sendPaths: [{ref: 'privateFolder', sub: 'test.txt'}]}, {
    phone: true,
    seal: ['teams', 'inbox'],
  }),
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
  ...modal('fs-confirm-delete', 'confirmDelete', {mode: 'screen', path: {ref: 'privateFolder', sub: 'test.txt'}}, {phone: true}),
  ...modal(
    'fs-destination-picker',
    'destinationPicker',
    {parentPath: {ref: 'privateFolder'}, source: {path: {ref: 'privateFolder', sub: 'test.txt'}, type: 'move-or-copy'}},
    {phone: true, seal: ['kbfsPrivate']}
  ),
  // its new folder row, named but not made: the folder exists only once its Create is pressed
  ...modal(
    'fs-destination-picker-new-folder',
    'destinationPicker',
    {parentPath: {ref: 'privateFolder'}, source: {path: {ref: 'privateFolder', sub: 'test.txt'}, type: 'move-or-copy'}},
    {
      phone: true,
      ready: T.FILES_EDITING_ROW,
      seal: ['kbfsPrivate'],
      setup: [
        {kind: 'click', testID: T.FILES_NEW_FOLDER},
        {kind: 'type', testID: T.FILES_EDITING_ROW, text: 'visual gate'},
      ],
    }
  ),
  // The preview screen a file row pushes. Without the file's last-modified time (which the row
  // passes and no ParamRef supplies) it shows its "content has updated" banner.
  {
    id: 'files/preview',
    nav: {append: {name: 'fsFilePreview', params: {path: {ref: 'privateFolder', sub: 'test.txt'}}}, tab: 'tabs.fsTab'},
    platforms: ['desktop', 'phone'],
    ready: T.FILES_TEXT_PREVIEW,
    seal: ['kbfsPrivate'],
  },
  ...modal('git-delete-repo', 'gitDeleteRepo', {name: 'e2e-kinds-repo', teamname: {ref: 'teamname'}}, {phone: true}),
  ...teamModal(
    'git-select-channel',
    'gitSelectChannel',
    {...team, repoID: 'visual-gate', selected: 'general', teamname: {ref: 'teamname'}},
    {phone: true, seal: ['teams', 'inbox']}
  ),
  ...modal('device-revoke', 'deviceRevoke', {deviceID: {ref: 'deviceID'}}, {phone: true, seal: ['devices']}),
  ...modal('profile-import', 'profileImport', {}, {phone: true}),
  ...modal(
    'profile-revoke',
    'profileRevoke',
    {icon: [], platform: 'github', platformHandle: 'visualgate', proofId: 'visual-gate'},
    {phone: true}
  ),
  ...modal('settings-password', 'settingsTabs.password', {}, {phone: true}),
  ...modal('settings-log-out', 'settingsTabs.logOutTab', {}, {phone: true}),
  ...modal('settings-feedback', 'modalFeedback', {}, {phone: true, ready: T.SETTINGS_FEEDBACK}),
  ...modal('proxy-settings', 'proxySettingsModal', {}, {phone: true}),
  ...modal('delete-account', 'deleteConfirm', {}, {phone: true}),
  ...modal('delete-account-password', 'checkPassphraseBeforeDeleteAccount', {}, {desktop: false, phone: true}),
  ...modal('settings-delete-email', 'settingsDeleteAddress', {address: 'visualgate@example.com', searchable: false, type: 'email'}, {phone: true}),
  // Without initialResend nothing is sent on open.
  ...modal('settings-verify-phone', 'settingsVerifyPhone', {initialResend: false, phoneNumber: '+12015550123'}, {phone: true}),
  ...modal('settings-push-prompt', 'settingsPushPrompt', {}, {desktop: false, phone: true}),
  ...modal('wallet-remove', 'removeAccount', {accountID: 'visual-gate', balanceDescription: '0 XLM', name: 'Visual gate'}, {phone: true}),
  {
    id: 'settings/db-nuke',
    nav: {append: {name: 'dbNukeConfirm', params: {}}, tab: 'tabs.settingsTab'},
    platforms: ['desktop', 'phone'],
    ready: T.SETTINGS_DB_NUKE_CONFIRM,
    seal: [],
  },
  {
    id: 'settings/link-error',
    nav: {append: {name: 'keybaseLinkError', params: {error: 'This link is not valid.'}}, tab: 'tabs.settingsTab'},
    platforms: ['desktop', 'phone'],
    ready: T.KEYBASE_LINK_ERROR,
    seal: [],
  },
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
  // its skin tones expanded; picking one would save it
  ...modal(
    'chat-emoji-skin-tones',
    'chatChooseEmoji',
    {conversationIDKey: short, pickKey: 'reaction'},
    {phone: true, ready: T.CHAT_SKIN_TONE_OPTIONS, seal: ['inbox'], setup: [{kind: 'click', testID: T.CHAT_SKIN_TONE_BUTTON}]}
  ),
  ...windows,
  ...fixtureEntries,
]

// Routes from `yarn visual:routes` the tour leaves out, and why. Every other route has an entry,
// on each platform it exists on.
//
// Signed out, provisioning or resetting (the gate runs signed in): login, feedback,
//   recoverPassword*, reset*, signupError, signupEnter*, signupSendFeedbackLoggedOut,
//   signupVerifyPhoneNumber, and the provision screens
//
// A write on open:
//   devicePaperKey: makes and provisions a new paper key
//   settingsTabs.contactsTab (phone): saves the address book, or an empty one, to the server
//   chatLocationPreview (phone): sends the device's position to the service on every fix (and
//     shows a live map)
//
// Data the account lacks, or content the server picks:
//   reallyRemoveAccount: fetches the secret key of a wallet account; the account has none, and with
//     a made-up ID it waits without end
//   incomingShareNew: needs items shared from another app; without them it loads without end
//   chatUnfurlMapPopup: a map tile fetched for the coordinates, most of the screen; it would need a
//     mask over nearly all of it
//   webLinks: an external web page
//   chatMessagePopup (phone): needs a message ID, which no ParamRef supplies; the app itself never
//     opens this route (message menus are in-place popups, which chat/message-menu covers)
//
// Driver limitations:
//   the profile card a username shows on hover (desktop): it opens through a lodash debounce, which
//     measures its wait with Date.now(), and under the frozen clock that wait never passes
//   teamAddToTeamContacts, teamInviteByContact (phone; desktop renders nothing): open the system's
//     contacts permission prompt, which no step can answer, and answering it changes the
//     simulator's privacy settings
//
// Unstable, not masked:
//   accountSwitcher (phone): in the round after a reload, its row avatars and the next entry's
//     composer icons draw a subpixel off between the two captures
//   phone files/team: in some app launches the first time the folder is pushed, its header's
//     "..." button draws its dots 1px off from every later push (327 px; seen in 5 of 8 rounds,
//     always the first push of the launch). Native header layout, not data; no ready state to
//     wait for. Desktop captures it.
//   archiveModal of a folder (type fsPath): the folder's info line spins without end for the
//     empty team folder.
//
// Platform or build: settingsTabs.cryptoTab, settingsTabs.devicesTab and settingsTabs.gitTab are
// tablet-only sub-tabs on desktop (desktop has them as tabs; the phone entries tab/crypto,
// tab/devices and tab/git open them); makeIcons is a desktop developer tool that renders only in
// dev builds; kextPermission is macOS only; checkPassphraseBeforeDeleteAccount, settingsPushPrompt
// and the crypto *Output routes are phone screens (desktop renders nothing, or shows the output
// beside the input). Desktop-only entries for screens the phone also has: chat/message-react and
// chat/message-menu (the phone opens them with a long press, which setup can't do),
// chat/thread-search (its phone button is a native header bar item with no testID; the phone's
// search opens from its route param in chat/thread-search-no-results), chat/reaction-tooltip (a
// long press on the phone), team/members-selected (its note), and
// chat/info-panel-media, -docs, -links and files/team (their notes), and modal/profile-avatar (the
// phone opens the system photo picker over it). Not routes: the menubar, the tracker popup,
// pinentry and unlock-folders are windows of their own, toured as window/* (unlock-folders' success
// step needs a paper key submitted, and the menubar's logged-out views a signed-out app); global
// errors and runtime stats are debug overlays.
//
// One screen, one id: an entry that's a tab on one platform and a page on the other keeps the tab's
// id on both (tab/git, tab/devices, tab/settings). Two phone roots have no desktop screen of their
// own. tab/crypto is the phone's crypto list; desktop's crypto tab opens on crypto/encrypt beside
// the same list. tab/chat is the phone's inbox; desktop's sits beside a conversation, so every
// desktop chat entry captures it. A desktop tab/chat entry would be one of those again, and the
// first chat entry of a session can't be one: until its conversation loads, the conversation the
// app opened at launch satisfies ready (aa: 2 of 4 pairs differ). walletsRoot is the screen of
// settingsTabs.walletsTab (settings/wallet).
