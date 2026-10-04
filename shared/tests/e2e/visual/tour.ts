import * as T from '../shared/test-ids.ts'
import type {Mask, TourEntry} from './tour-types.ts'

// Tab names are the values in constants/tabs.tsx. Desktop shows eight tabs; phone shows people,
// chat, files, teams and settings.
//
// Capture never resets scroll position or a selected sub-tab, so every entry on a screen with
// sub-tabs selects its own (switchSubTab), and nothing here scrolls.

const team = {teamID: {ref: 'teamID'}} as const
const followSuggestions: Mask = {reason: 'people feed follow suggestions, server-picked', testID: T.PEOPLE_FOLLOW_SUGGESTIONS}
const deviceLastUsed: Mask = {reason: 'device last-used time, server-pushed', testID: T.DEVICES_ROW_LAST_USED}

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
  {
    id: 'chat/info-panel',
    nav: {
      append: {
        name: 'chatInfoPanel',
        params: {conversationIDKey: {channel: 'e2e-short', ref: 'conversationIDKey'}, tab: 'members'},
      },
      tab: 'tabs.chatTab',
    },
    platforms: ['phone'],
    ready: T.CHAT_INFO_PANEL,
    seal: ['inbox', 'teams'],
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
  teamTab('emoji', T.TEAMS_TAB_EMOJI_BUTTON, T.TEAMS_TABS),
  teamTab('settings', T.TEAMS_TAB_SETTINGS_BUTTON, T.TEAMS_SETTINGS_TAB),
  teamTab('bots', T.TEAMS_TAB_BOTS_BUTTON, T.TEAMS_BOTS_TAB),
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
    ready: T.SETTINGS_ACCOUNT,
    seal: [],
    setup: [{kind: 'switchSubTab', testID: T.SETTINGS_ROW_ICONS}],
  },
  {
    id: 'settings/wallet',
    nav: {tab: 'tabs.settingsTab'},
    platforms: ['desktop'],
    ready: T.SETTINGS_ACCOUNT,
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
  // Modals that only show something; they change nothing until a button in them is pressed, which
  // the tour never does. Those opened from settings open over the devices tab instead: behind the
  // modal, settings would show whichever sub-tab an earlier entry left selected.
  {
    id: 'modal/device-add',
    masks: [deviceLastUsed],
    nav: {append: {name: 'deviceAdd', params: {}}, tab: 'tabs.devicesTab'},
    platforms: ['desktop'],
    ready: T.MODAL_CLOSE,
    seal: ['devices'],
  },
  {
    id: 'modal/add-email',
    masks: [deviceLastUsed],
    nav: {append: {name: 'settingsAddEmail', params: {}}, tab: 'tabs.devicesTab'},
    platforms: ['desktop'],
    ready: T.MODAL_CLOSE,
    seal: ['devices'],
  },
  {
    id: 'modal/add-phone',
    masks: [deviceLastUsed],
    nav: {append: {name: 'settingsAddPhone', params: {}}, tab: 'tabs.devicesTab'},
    platforms: ['desktop'],
    ready: T.MODAL_CLOSE,
    seal: ['devices'],
  },
  {
    id: 'modal/kext-permission',
    masks: [deviceLastUsed],
    nav: {append: {name: 'kextPermission', params: {}}, tab: 'tabs.devicesTab'},
    platforms: ['desktop'],
    ready: T.MODAL_CLOSE,
    seal: ['devices'],
  },
  {
    id: 'modal/team-edit-info',
    nav: {append: {name: 'teamEditTeamInfo', params: team}, tab: 'tabs.teamsTab'},
    platforms: ['desktop'],
    ready: T.MODAL_CLOSE,
    seal: ['teams'],
  },
]

// Routes from `yarn visual:routes` the tour leaves out, and why.
//
// Signed out (the gate runs signed in):
//   login, feedback, recoverPassword*, reset*, proxySettingsModal, signupError, signupEnter*,
//   signupSendFeedback*, signupVerifyPhoneNumber
//
// Reached only through a write, or a form whose only exit is a write:
//   chatAddToChannel, chatBlockingModal, chatConfirmRemoveBot, chatCreateChannel,
//   chatDeleteHistoryWarning, chatForwardMsgPick, chatInstallBot, chatInstallBotPick,
//   chatSendToChat, chatShowNewTeamDialog, chatEnterPaperkey (rekey), devicePaperKey (makes a
//   paper key on open), deviceRevoke, confirmDelete, destinationPicker, gitDeleteRepo,
//   gitNewRepo, gitSelectChannel, incomingShareNew, profileAddToTeam, profileEdit,
//   profileEditAvatar, profileImport, profilePgp, profileProofsList, profileRevoke,
//   profileShowcaseTeamOffer, checkPassphraseBeforeDeleteAccount, dbNukeConfirm, deleteConfirm,
//   archiveModal, settingsTabs.password, settingsTabs.logOutTab, settingsPushPrompt,
//   settingsContactsJoined, settingsVerifyPhone, settingsDeleteAddress, contactRestricted,
//   openTeamWarning, retentionWarning, teamAddEmoji, teamAddEmojiAlias, teamAddToChannels,
//   teamAddToTeam*, teamCreateChannels, teamDeleteChannel, teamDeleteTeam, teamEditChannel,
//   teamEditTeamDescription, teamInviteBy*, teamInviteLinkJoin, teamJoinTeamDialog,
//   teamNewTeamDialog, teamReallyLeaveTeam, teamReallyRemove*, teamRename, teamWizard*,
//   reallyRemoveAccount, removeAccount
//
// Need a specific message, file or output the account doesn't hold, or that only a typed input
// produces (setup steps can't type): chatAttachmentFullscreen, chatAttachmentGetTitles, chatPDF,
// chatLocationPreview, chatUnfurlMapPopup, chatMessagePopup, chatConfirmNavigateExternal,
// chatChooseEmoji, fsFilePreview (the team folder is empty), decryptOutput, encryptOutput,
// signOutput, verifyOutput, keybaseLinkError, webLinks (an external page), teamExternalTeam (a
// team the account is not in), team subteams tab (the team has none)
//
// Server-picked content that would fill most of the screen: chatNewChat, chatSearchBots,
// peopleTeamBuilder, cryptoTeamBuilder, teamsTeamBuilder (recommendation lists)
//
// Platform or build: settingsTabs.cryptoTab, settingsTabs.devicesTab and settingsTabs.gitTab are
// tablet-only sub-tabs on desktop (desktop has them as tabs); settingsTabs.contactsTab and
// accountSwitcher are phone screens with nothing to wait on (contacts also needs the OS
// permission); makeIcons is a developer tool; kextPermission, the modal add email/phone/device
// entries and the settings sub-pages without a phone testID are desktop only.
//
// Unstable, not masked:
//   profile (self): reopening a profile within 30s of closing it shows an empty profile with
//     spinning follower counts that never fill in (tracker/identify-session.tsx: the closed
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
