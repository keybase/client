// Electron: page.getByTestId(T.CHAT_INBOX_LIST)
// iOS/Maestro: - assertVisible: { id: "chat-inbox-list" }

// Navigation tabs (desktop tab bar — new additions)
export const NAV_TAB_PEOPLE   = 'nav-tab-people'
export const NAV_TAB_CHAT     = 'nav-tab-chat'
export const NAV_TAB_FILES    = 'nav-tab-files'
export const NAV_TAB_CRYPTO   = 'nav-tab-crypto'
export const NAV_TAB_TEAMS    = 'nav-tab-teams'
export const NAV_TAB_GIT      = 'nav-tab-git'
export const NAV_TAB_DEVICES  = 'nav-tab-devices'
export const NAV_TAB_SETTINGS = 'nav-tab-settings'

// Chat
export const CHAT_INBOX_LIST   = 'chat-inbox-list'
export const CHAT_INBOX_ROW    = 'chat-inbox-row'
export const CHAT_MESSAGE_LIST = 'chat-message-list'
export const CHAT_INPUT        = 'chat-input'
export const CHAT_SEND_BUTTON  = 'chat-send-button'
export const CHAT_INFO_PANEL   = 'chat-info-panel'
export const CHAT_EMOJI_PICKER = 'chat-emoji-picker'
export const CHAT_ATTACHMENT_IMAGE      = 'chat-attachment-image'
export const CHAT_ATTACHMENT_FULLSCREEN = 'chat-attachment-fullscreen'
export const CHAT_BOT_ROW               = 'chat-bot-row'
// the install modal's footer button varies with the bot's state (Install /
// Review / Edit settings / Uninstall), so tests key off the modal itself
export const CHAT_BOT_INSTALL           = 'chat-bot-install'
export const CHAT_SUGGESTION_LIST       = 'chat-suggestion-list'
export const CHAT_EMOJI_BUTTON          = 'chat-emoji-button'
export const CHAT_INFO_PANEL_SETTINGS_TAB = 'chat-info-panel-settings-tab'
// Android only: iOS 26 folds Search/Info into one native "More" header menu,
// but the Android header keeps the plain info icon — icons have no tappable text
export const CHAT_HEADER_INFO_BUTTON = 'chat-header-info-button'
export const CHAT_HEADER_SEARCH_BUTTON   = 'chat-header-search-button'
export const CHAT_THREAD_SEARCH_CANCEL   = 'chat-thread-search-cancel'
// The thread search query field. It focuses itself a beat after mounting, so a test types into it
// rather than sending keys and hoping the focus landed.
export const CHAT_THREAD_SEARCH_INPUT    = 'chat-thread-search-input'
// "3 of 18" in the thread search bar. Read through this rather than matching " of " on screen: the
// thread behind the bar is full of message text and a body containing " of " matches first.
export const CHAT_THREAD_SEARCH_COUNT    = 'chat-thread-search-count'
export const CHAT_THREAD_SEARCH_PREV     = 'chat-thread-search-prev'
export const CHAT_THREAD_SEARCH_NEXT     = 'chat-thread-search-next'
// The row a thread search is currently sitting on. Really "the centre-highlighted row": pinned
// messages, reply jumps and permalinks highlight one too, so this only means "search hit" inside a
// search flow. Present only while the row is highlighted.
export const CHAT_SEARCH_HIT             = 'chat-search-hit'
// The header above the oldest loaded message. Mounted in every state - loading, more to load, start
// of the conversation - so its position is readable throughout, which is how a test sees a page of
// older messages arrive.
export const CHAT_THREAD_TOP             = 'chat-thread-top'

// Files
export const FILES_BROWSER = 'files-browser'
export const FILES_TLF_ROW = 'files-tlf-row'

// Teams
export const TEAMS_LIST         = 'teams-list'
export const TEAMS_ROW          = 'teams-row'
export const TEAMS_BODY         = 'teams-body'
export const TEAMS_TABS         = 'teams-tabs'
export const TEAMS_MEMBER_LIST  = 'teams-member-list'
export const TEAMS_MEMBER_PAGE  = 'teams-member-page'
export const TEAMS_CHANNEL_LIST = 'teams-channel-list'
export const TEAMS_SETTINGS_TAB = 'teams-settings-tab'
export const TEAMS_BOTS_TAB     = 'teams-bots-tab'
// The settings team-tab is an icon-only gear on phone (no tappable text), so it
// needs its own testID on the tab button (distinct from TEAMS_SETTINGS_TAB,
// which marks the settings tab's content).
export const TEAMS_TAB_SETTINGS_BUTTON = 'teams-tab-settings-button'
export const TEAMS_TAB_MEMBERS_BUTTON  = 'teams-tab-members-button'

// Devices
export const DEVICES_LIST = 'devices-list'
export const DEVICES_ROW  = 'devices-row'
export const DEVICE_PAGE  = 'device-page'

// Settings
export const SETTINGS_ACCOUNT           = 'settings-account'
export const SETTINGS_NAV_ITEM          = 'settings-nav-item'
export const SETTINGS_ADVANCED          = 'settings-advanced'
export const SETTINGS_ABOUT             = 'settings-about'
export const SETTINGS_ARCHIVE           = 'settings-archive'
export const SETTINGS_CHAT              = 'settings-chat'
export const SETTINGS_DISPLAY           = 'settings-display'
export const SETTINGS_FEEDBACK          = 'settings-feedback'
export const SETTINGS_FILES             = 'settings-files'
// Settings-list ROW testIDs (distinct from the subpage content above). Needed
// for Chat/Files because their row text collides with the bottom tab bar's
// "Chat"/"Files" tabs, making a text match ambiguous.
export const SETTINGS_ROW_CHAT          = 'settings-row-chat'
export const SETTINGS_ROW_FILES         = 'settings-row-files'
export const SETTINGS_NOTIFICATIONS     = 'settings-notifications'
export const SETTINGS_SCREENPROTECTOR   = 'settings-screenprotector'
// Dev-only debug pages (gated by __DEV__ in nav + routes)
export const SETTINGS_TYPOGRAPHY        = 'settings-typography'
export const SETTINGS_MARKDOWN          = 'settings-markdown'

// People
export const PEOPLE_FEED = 'people-feed'
export const PEOPLE_HEADER_AVATAR = 'people-header-avatar'

// Profile
export const PROFILE_PAGE = 'profile-page'

// Git
export const GIT_REPO_LIST = 'git-repo-list'
export const GIT_REPO_ROW  = 'git-repo-row'

// Crypto
export const CRYPTO_INPUT         = 'crypto-input'
export const CRYPTO_OUTPUT        = 'crypto-output'
export const CRYPTO_NAV_ENCRYPT   = 'crypto-nav-encryptTab'
export const CRYPTO_NAV_DECRYPT   = 'crypto-nav-decryptTab'
export const CRYPTO_NAV_SIGN      = 'crypto-nav-signTab'
export const CRYPTO_NAV_VERIFY    = 'crypto-nav-verifyTab'
export const CRYPTO_ENCRYPT_INPUT = 'crypto-encrypt-input'
export const CRYPTO_DECRYPT_INPUT = 'crypto-decrypt-input'
export const CRYPTO_SIGN_INPUT    = 'crypto-sign-input'
export const CRYPTO_VERIFY_INPUT  = 'crypto-verify-input'
export const CRYPTO_RUN_BUTTON    = 'crypto-run-button'
export const CRYPTO_RECIPIENTS    = 'crypto-recipients'
// The recipients field is a display-only input inside a pointerEvents="none"
// wrapper, so only this outer clickable can receive a click.

// Common — keep value matching existing testID="backButton" in .maestro subflows
export const COMMON_BACK_BUTTON = 'backButton'
