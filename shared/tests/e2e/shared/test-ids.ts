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

// Teams
export const TEAMS_LIST = 'teams-list'
export const TEAMS_ROW  = 'teams-row'

// Devices
export const DEVICES_LIST = 'devices-list'
export const DEVICES_ROW  = 'devices-row'

// Settings
export const SETTINGS_ACCOUNT  = 'settings-account'
export const SETTINGS_NAV_ITEM = 'settings-nav-item'

// People
export const PEOPLE_FEED = 'people-feed'

// Git
export const GIT_REPO_LIST = 'git-repo-list'
export const GIT_REPO_ROW  = 'git-repo-row'

// Crypto
export const CRYPTO_INPUT  = 'crypto-input'
export const CRYPTO_OUTPUT = 'crypto-output'

// Common — keep value matching existing testID="backButton" in .maestro subflows
export const COMMON_BACK_BUTTON = 'backButton'
