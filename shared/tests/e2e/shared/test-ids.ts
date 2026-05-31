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

// Files
export const FILES_BROWSER = 'files-browser'
export const FILES_TLF_ROW = 'files-tlf-row'

// Teams
export const TEAMS_LIST         = 'teams-list'
export const TEAMS_ROW          = 'teams-row'
export const TEAMS_BODY         = 'teams-body'
export const TEAMS_TABS         = 'teams-tabs'
export const TEAMS_MEMBER_LIST  = 'teams-member-list'
export const TEAMS_CHANNEL_LIST = 'teams-channel-list'
export const TEAMS_SETTINGS_TAB = 'teams-settings-tab'
export const TEAMS_BOTS_TAB     = 'teams-bots-tab'

// Devices
export const DEVICES_LIST = 'devices-list'
export const DEVICES_ROW  = 'devices-row'

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
export const SETTINGS_NOTIFICATIONS     = 'settings-notifications'
export const SETTINGS_SCREENPROTECTOR   = 'settings-screenprotector'

// People
export const PEOPLE_FEED = 'people-feed'

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

// Common — keep value matching existing testID="backButton" in .maestro subflows
export const COMMON_BACK_BUTTON = 'backButton'
