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
// an installed restricted bot's permissions list, its Edit settings button, the edit screen's
// channel dropdown, and the channel picker it opens
export const CHAT_BOT_PERMS             = 'chat-bot-perms'
export const CHAT_BOT_EDIT_BUTTON       = 'chat-bot-edit-button'
export const CHAT_BOT_CHANNELS_DROPDOWN = 'chat-bot-channels-dropdown'
export const CHAT_BOT_CHANNEL_PICKER    = 'chat-bot-channel-picker'
export const CHAT_SUGGESTION_LIST       = 'chat-suggestion-list'
// a bot command's help, shown over the composer once its text names the command
export const CHAT_COMMAND_MARKDOWN      = 'chat-command-markdown'
export const CHAT_EMOJI_BUTTON          = 'chat-emoji-button'
// the phone composer's other buttons: @, camera, audio and + (a read-only channel hides them all)
export const CHAT_MENTION_BUTTON        = 'chat-mention-button'
export const CHAT_CAMERA_BUTTON         = 'chat-camera-button'
export const CHAT_AUDIO_BUTTON          = 'chat-audio-button'
export const CHAT_MORE_BUTTON           = 'chat-more-button'
export const CHAT_INFO_PANEL_SETTINGS_TAB = 'chat-info-panel-settings-tab'
export const CHAT_INFO_PANEL_MEMBERS_TAB = 'chat-info-panel-members-tab'
export const CHAT_INFO_PANEL_ATTACHMENTS_TAB = 'chat-info-panel-attachments-tab'
export const CHAT_INFO_PANEL_BOTS_TAB = 'chat-info-panel-bots-tab'
export const CHAT_INFO_PANEL_PARTICIPANT = 'chat-info-panel-participant'
// the attachments tab's Media / Docs / Links selector
export const CHAT_INFO_PANEL_MEDIA = 'chat-info-panel-media'
export const CHAT_INFO_PANEL_DOCS = 'chat-info-panel-docs'
export const CHAT_INFO_PANEL_LINKS = 'chat-info-panel-links'
export const CHAT_INFO_PANEL_MENU_BUTTON = 'chat-info-panel-menu-button'
// Desktop and Android: iOS 26 folds Search/Info into one native "More" header menu,
// but the Android header keeps the plain info icon — icons have no tappable text
export const CHAT_HEADER_INFO_BUTTON = 'chat-header-info-button'
// Desktop conversation header: the title row (team#channel, or the participants) and the search
// icon. Mobile's header is the native navigation bar.
export const CHAT_HEADER_TITLE         = 'chat-header-title'
export const CHAT_HEADER_SEARCH_BUTTON = 'chat-header-search-button'
// Thread search: the whole search bar, the box holding its text input (Input3 takes no testID),
// and each hit row (desktop only: mobile shows a counter, not a hit list)
export const CHAT_THREAD_SEARCH       = 'chat-thread-search'
export const CHAT_THREAD_SEARCH_INPUT = 'chat-thread-search-input'
export const CHAT_THREAD_SEARCH_HIT   = 'chat-thread-search-hit'
export const CHAT_JUMP_TO_RECENT      = 'chat-jump-to-recent'
export const CHAT_CATCH_UP            = 'chat-catch-up'
export const CHAT_PINNED_BANNER       = 'chat-pinned-banner'
export const CHAT_REPLY_PREVIEW       = 'chat-reply-preview'
export const CHAT_REPLY_CANCEL        = 'chat-reply-cancel'
export const CHAT_EDIT_CANCEL         = 'chat-edit-cancel'
// desktop message hover bar and ... menu
export const CHAT_MESSAGE_REACT_BUTTON = 'chat-message-react-button'
export const CHAT_MESSAGE_MENU_BUTTON  = 'chat-message-menu-button'
// a suggestion row carries the _SELECTED id while it is the highlighted one
export const CHAT_SUGGESTION_ROW          = 'chat-suggestion-row'
export const CHAT_SUGGESTION_ROW_SELECTED = 'chat-suggestion-row-selected'
// the video attachment's corner fullscreen button; its unit tests match the literal value
export const CHAT_VIDEO_FULLSCREEN    = 'video-fullscreen'

// Files
export const FILES_BROWSER = 'files-browser'
// a path the account can't read, or that doesn't exist
export const FILES_OOPS = 'files-oops'
export const FILES_TLF_ROW = 'files-tlf-row'

// Teams
export const TEAMS_LIST         = 'teams-list'
export const TEAMS_ROW          = 'teams-row'
export const TEAMS_BODY         = 'teams-body'
export const TEAMS_TABS         = 'teams-tabs'
export const TEAMS_MEMBER_LIST  = 'teams-member-list'
export const TEAMS_MEMBER_PAGE  = 'teams-member-page'
export const TEAMS_MEMBER_ADD_TO_TEAM_BUTTON = 'teams-member-add-to-team-button'
export const TEAMS_ROLE_PICKER = 'teams-role-picker'
export const TEAMS_HEADER_MENU_BUTTON = 'teams-header-menu-button'
export const TEAMS_CHANNEL_LIST = 'teams-channel-list'
export const TEAMS_CHANNEL_PAGE = 'teams-channel-page'
export const TEAMS_SETTINGS_TAB = 'teams-settings-tab'
export const TEAMS_BOTS_TAB     = 'teams-bots-tab'
export const TEAMS_EMOJI_TAB = 'teams-emoji-tab'
// The settings team-tab is an icon-only gear on phone (no tappable text), so it
// needs its own testID on the tab button (distinct from TEAMS_SETTINGS_TAB,
// which marks the settings tab's content).
export const TEAMS_TAB_SETTINGS_BUTTON = 'teams-tab-settings-button'
export const TEAMS_TAB_MEMBERS_BUTTON  = 'teams-tab-members-button'
export const TEAMS_TAB_CHANNELS_BUTTON = 'teams-tab-channels-button'
export const TEAMS_TAB_EMOJI_BUTTON = 'teams-tab-emoji-button'
export const TEAMS_TAB_BOTS_BUTTON = 'teams-tab-bots-button'
export const TEAMS_TAB_SUBTEAMS_BUTTON = 'teams-tab-subteams-button'
export const TEAMS_SUBTEAMS_TAB = 'teams-subteams-tab'
// a team row on a member's page: its expand caret, and the last-activity line it reveals
export const TEAMS_MEMBER_TEAM_EXPAND = 'teams-member-team-expand'
export const TEAMS_MEMBER_TEAM_ACTIVITY = 'teams-member-team-activity'

// Devices
export const DEVICES_LIST = 'devices-list'
export const DEVICES_ROW  = 'devices-row'
export const DEVICE_PAGE  = 'device-page'
// last-used times: the service updates them while a device is in use
export const DEVICES_ROW_LAST_USED = 'devices-row-last-used'
export const DEVICE_PAGE_LAST_USED = 'device-page-last-used'

// Settings
export const SETTINGS_ACCOUNT           = 'settings-account'
// the account sub-page itself (SETTINGS_ACCOUNT is the settings nav that holds it)
export const SETTINGS_ACCOUNT_PAGE = 'settings-account-page'
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
// the desktop left nav's other rows
export const SETTINGS_ROW_ACCOUNT = 'settings-row-account'
export const SETTINGS_ROW_ADVANCED = 'settings-row-advanced'
export const SETTINGS_ROW_ARCHIVE = 'settings-row-archive'
export const SETTINGS_ROW_DISPLAY = 'settings-row-display'
export const SETTINGS_ROW_FEEDBACK = 'settings-row-feedback'
export const SETTINGS_ROW_NOTIFICATIONS = 'settings-row-notifications'
export const SETTINGS_ROW_SCREENPROTECTOR = 'settings-row-screenprotector'
export const SETTINGS_ROW_WALLET = 'settings-row-wallet'
export const SETTINGS_ROW_TYPOGRAPHY = 'settings-row-typography'
export const SETTINGS_ROW_ICONS = 'settings-row-icons'
export const SETTINGS_ROW_MARKDOWN = 'settings-row-markdown'
export const SETTINGS_ROW_ABOUT = 'settings-row-about'
export const SETTINGS_NOTIFICATIONS     = 'settings-notifications'
export const SETTINGS_SCREENPROTECTOR   = 'settings-screenprotector'
export const SETTINGS_WALLET = 'settings-wallet'
// Dev-only debug pages (gated by __DEV__ in nav + routes)
export const SETTINGS_TYPOGRAPHY        = 'settings-typography'
export const SETTINGS_MARKDOWN          = 'settings-markdown'
export const SETTINGS_ICONS = 'settings-icons'

// People
export const PEOPLE_FEED = 'people-feed'
export const PEOPLE_HEADER_AVATAR = 'people-header-avatar'
// the server-picked "Consider following..." users
export const PEOPLE_FOLLOW_SUGGESTIONS = 'people-follow-suggestions'

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

// A desktop floating menu (message "..." menu, header menus); mobile menus are bottom sheets
export const FLOATING_MENU = 'floating-menu'

// Common — keep value matching existing testID="backButton" in .maestro subflows
export const COMMON_BACK_BUTTON = 'backButton'
// The X on a desktop modal route. Needed because a page-wide search for the
// close iconfont also matches the unfurl dismiss icons in the conversation
// behind the modal, which sit earlier in the DOM and are covered by the overlay.
// the add-device modal once its illustrations are final
export const DEVICES_ADD_DEVICE = 'devices-add-device'
export const MODAL_CLOSE = 'modal-close'
// a phone modal screen's container
export const MODAL_SCREEN = 'modal-screen'
// the team builder's recommendation list
export const TEAM_BUILDING_RECS = 'team-building-recs'
