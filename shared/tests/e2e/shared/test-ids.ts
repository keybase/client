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
// the install screen's In these channels dropdown itself, the box a tap opens the picker from
export const CHAT_BOT_CHANNELS_BUTTON   = 'chat-bot-channels-button'
export const CHAT_SUGGESTION_LIST       = 'chat-suggestion-list'
// a bot command's help, shown over the composer once its text names the command
export const CHAT_COMMAND_MARKDOWN      = 'chat-command-markdown'
export const CHAT_EMOJI_BUTTON          = 'chat-emoji-button'
// the phone composer's other buttons: @, camera, audio and + (a read-only channel hides them all)
export const CHAT_MENTION_BUTTON        = 'chat-mention-button'
export const CHAT_CAMERA_BUTTON         = 'chat-camera-button'
export const CHAT_AUDIO_BUTTON          = 'chat-audio-button'
export const CHAT_MORE_BUTTON           = 'chat-more-button'
// the camera button's attach sheet on the phone: take a photo or video, choose from the library, choose a file
export const CHAT_ATTACH_CAMERA         = 'chat-attach-camera'
export const CHAT_ATTACH_LIBRARY        = 'chat-attach-library'
export const CHAT_ATTACH_FILE           = 'chat-attach-file'
// the + menu's "Share your location" row
export const CHAT_MORE_SHARE_LOCATION = 'chat-more-share-location'
// the location screen's buttons: live for 15 minutes, 1 hour, 8 hours, and the current location
export const CHAT_LOCATION_LIVE_15M = 'chat-location-live-15m'
export const CHAT_LOCATION_LIVE_1H = 'chat-location-live-1h'
export const CHAT_LOCATION_LIVE_8H = 'chat-location-live-8h'
export const CHAT_LOCATION_SEND_CURRENT = 'chat-location-send-current'
export const CHAT_INFO_PANEL_SETTINGS_TAB = 'chat-info-panel-settings-tab'
export const CHAT_INFO_PANEL_MEMBERS_TAB = 'chat-info-panel-members-tab'
export const CHAT_INFO_PANEL_ATTACHMENTS_TAB = 'chat-info-panel-attachments-tab'
export const CHAT_INFO_PANEL_BOTS_TAB = 'chat-info-panel-bots-tab'
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
// the hit count (or "No results") once a search has run
export const CHAT_THREAD_SEARCH_STATUS = 'chat-thread-search-status'
export const CHAT_JUMP_TO_RECENT      = 'chat-jump-to-recent'
export const CHAT_CATCH_UP            = 'chat-catch-up'
export const CHAT_PINNED_BANNER       = 'chat-pinned-banner'
export const CHAT_REPLY_PREVIEW       = 'chat-reply-preview'
// a message's row of reactions
export const CHAT_REACTIONS_ROW       = 'chat-reactions-row'
// one reaction in that row (desktop: hovering it shows who reacted) and that tooltip
export const CHAT_REACTION_ITEM       = 'chat-reaction-item'
export const CHAT_REACTION_TOOLTIP    = 'chat-reaction-tooltip'
// the pinned banner's close icon, only while it would ask before unpinning, and that prompt
export const CHAT_PINNED_UNPIN        = 'chat-pinned-unpin'
export const CHAT_UNPIN_PROMPT        = 'chat-unpin-prompt'
// Message kinds the gate's chat-thread-content fixture supplies (tests/e2e/visual/fixtures)
export const CHAT_ADDED_TO_TEAM       = 'chat-added-to-team'
export const CHAT_AUDIO_PLAYER        = 'chat-audio-player'
export const CHAT_MAP_UNFURL          = 'chat-map-unfurl'
// the block modal's report option, by its state: one of the two is drawn
export const CHAT_BLOCK_REPORT_ON      = 'chat-block-report-on'
export const CHAT_BLOCK_REPORT_OFF     = 'chat-block-report-off'
// the invitation-to-block row shown to someone added to a team, and its dismiss control
export const CHAT_BLOCK_BUTTONS        = 'chat-block-buttons'
export const CHAT_BLOCK_BUTTONS_DISMISS = 'chat-block-buttons-dismiss'
export const CHAT_UNFURL_PROMPT       = 'chat-unfurl-prompt'
// the link preview prompt's answers, and a posted generic (website) preview
export const CHAT_UNFURL_PROMPT_YES   = 'chat-unfurl-prompt-yes'
export const CHAT_UNFURL_PROMPT_NO    = 'chat-unfurl-prompt-no'
// the prompt's Remember for <domain> switch (on the phone only its switch takes a tap)
export const CHAT_UNFURL_PROMPT_REMEMBER = 'chat-unfurl-prompt-remember'
export const CHAT_UNFURL_GENERIC      = 'chat-unfurl-generic'
export const CHAT_PAYMENT             = 'chat-payment'
export const CHAT_JOURNEY_CARD        = 'chat-journey-card'
export const CHAT_EXPLODING_META      = 'chat-exploding-meta'
// the exploding message's header in its message menu
export const CHAT_EXPLODING_HEADER    = 'chat-exploding-header'
export const CHAT_COINFLIP            = 'chat-coinflip'
// a finished flip's participant count (desktop: hovering it lists them) and that list
export const CHAT_COINFLIP_PARTICIPANTS = 'chat-coinflip-participants'
export const CHAT_COINFLIP_PARTICIPANT_LIST = 'chat-coinflip-participant-list'
// the composer's typing indicator, and the unread line above the first unread message
export const CHAT_TYPING              = 'chat-typing'
export const CHAT_ORANGE_LINE         = 'chat-orange-line'
// the emoji picker's skin tone button, and the tones it expands to
export const CHAT_SKIN_TONE_BUTTON    = 'chat-skin-tone-button'
export const CHAT_SKIN_TONE_OPTIONS   = 'chat-skin-tone-options'
// one skin tone in the expanded options: the prefix, then the tone's code ('1F3FA' is the default yellow)
export const CHAT_SKIN_TONE_OPTION_PREFIX = 'chat-skin-tone-option-'
// a git push system message's body
export const CHAT_GIT_PUSH            = 'chat-git-push'
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
// a conversation result in the send-to-chat picker (Files > Share to Chat)
export const CHAT_SEND_TO_CHAT_ROW    = 'chat-send-to-chat-row'
// the phone composer's exploding timer, left of the input (it opens the explode-after sheet)
export const CHAT_EXPLODING_BUTTON    = 'chat-exploding-button'
// one of the phone message menu's quick reactions: the prefix, then the emoji's name (':+1:')
export const CHAT_QUICK_REACTION_PREFIX = 'chat-quick-reaction-'
// the pinned banner's close icon while it hides the pin for you without asking (CHAT_PINNED_UNPIN otherwise)
export const CHAT_PINNED_DISMISS      = 'chat-pinned-dismiss'
// the inbox's search placeholder, which opens the inbox filter
export const CHAT_INBOX_SEARCH        = 'chat-inbox-search'
// a big team's inbox header gear, which opens its team menu; and a channel row under it
export const CHAT_INBOX_BIG_TEAM_HEADER = 'chat-inbox-big-team-header'
export const CHAT_INBOX_CHANNEL_ROW   = 'chat-inbox-channel-row'
// what floats over the bottom of the phone inbox: the unread shortcut and the Big teams divider
export const CHAT_INBOX_UNREAD_SHORTCUT = 'chat-inbox-unread-shortcut'
export const CHAT_INBOX_BIG_TEAMS_DIVIDER = 'chat-inbox-big-teams-divider'
// the inbox header's New chat button
export const CHAT_NEW_CHAT_BUTTON     = 'chat-new-chat-button'
// the forward picker's search box, a conversation in its results, and the caption box an attachment's
// forward asks for
export const CHAT_FORWARD_SEARCH      = 'chat-forward-search'
export const CHAT_FORWARD_RESULT      = 'chat-forward-result'
export const CHAT_FORWARD_CAPTION     = 'chat-forward-caption'
// the caption field of the screen that sends an attachment (attachment-get-titles)
export const CHAT_ATTACHMENT_CAPTION  = 'chat-attachment-caption'
// a conversation's notification choice in its info panel: the prefix, then the group ('desktop' or
// 'mobile'), '-' and the choice ('onAnyActivity', 'onWhenAtMentioned' or 'never'); the chosen one
// of each group ends in the _SELECTED suffix
export const CHAT_NOTIFY_RADIO_PREFIX = 'chat-notify-radio-'
export const CHAT_NOTIFY_RADIO_SELECTED_SUFFIX = '-selected'
// the info panel's Mute all notifications switch (on the phone only its switch takes a tap)
export const CHAT_INFO_PANEL_MUTE     = 'chat-info-panel-mute'
// the info panel's Minimum role to post dropdown, which opens the role menu
export const CHAT_MIN_WRITER_ROLE_DROPDOWN = 'chat-min-writer-role-dropdown'

// Files
export const FILES_BROWSER = 'files-browser'
// a path the account can't read, or that doesn't exist
export const FILES_OOPS = 'files-oops'
export const FILES_TLF_ROW = 'files-tlf-row'
// a file, folder or TLF row in a folder listing
export const FILES_ROW = 'files-row'
// a download's card in the Files footer
export const FILES_DOWNLOAD = 'files-download'
// a text file's preview, once its content has loaded
export const FILES_TEXT_PREVIEW = 'files-text-preview'
// the phone's image, video (and audio) and pdf previews: the image once it is drawn, the pdf once its
// page has loaded
export const FILES_IMAGE_PREVIEW = 'files-image-preview'
export const FILES_VIDEO_PREVIEW = 'files-video-preview'
export const FILES_PDF_PREVIEW = 'files-pdf-preview'
// a chat pdf attachment's viewer, once it has the file: desktop's embed once it has a url, the
// phone's page once loaded
export const CHAT_PDF_VIEWER = 'chat-pdf-viewer'
// a row's "..." menu button (one per row)
export const FILES_ROW_MENU = 'files-row-menu'
// the destination picker's new folder button, and the unsaved name row it adds
export const FILES_NEW_FOLDER = 'files-new-folder'
export const FILES_EDITING_ROW = 'files-editing-row'
// the editing row's name field and its Create / Save button
export const FILES_EDITING_INPUT = 'files-editing-input'
export const FILES_EDITING_SAVE = 'files-editing-save'
// a folder's "Sync on this device" switch
export const FILES_SYNC_TOGGLE = 'files-sync-toggle'
// the phone's upload menu (the folder header's Upload): the photo library and the document picker
export const FILES_UPLOAD_MEDIA = 'files-upload-media'
export const FILES_UPLOAD_FILE = 'files-upload-file'
export const FILES_DESTINATION_PICKER = 'files-destination-picker'
// the Finder (system file manager) integration banner at the top of Files
export const FILES_SFMI_BANNER = 'files-sfmi-banner'

// Teams
export const TEAMS_LIST         = 'teams-list'
export const TEAMS_ROW          = 'teams-row'
export const TEAMS_BODY         = 'teams-body'
export const TEAMS_TABS         = 'teams-tabs'
export const TEAMS_MEMBER_LIST  = 'teams-member-list'
export const TEAMS_MEMBER_PAGE  = 'teams-member-page'
// a member row in a team's Members tab, and a channel row in its Channels tab
export const TEAMS_MEMBER_ROW = 'teams-member-row'
export const TEAMS_CHANNEL_ROW = 'teams-channel-row'
// a member row on a channel's page, a pending invite's row and a request to join's row in a team's
// Members tab
export const TEAMS_CHANNEL_MEMBER_ROW = 'teams-channel-member-row'
export const TEAMS_INVITE_ROW = 'teams-invite-row'
export const TEAMS_REQUEST_ROW = 'teams-request-row'
// a channel row of a member's "Add to channels" on the phone (the id says whether its circle is checked:
// picked, #general, or a channel the member is already in)
export const TEAMS_ADD_TO_CHANNELS_ROW = 'teams-add-to-channels-row'
export const TEAMS_ADD_TO_CHANNELS_ROW_CHECKED = 'teams-add-to-channels-row-checked'
export const TEAMS_MEMBER_ADD_TO_TEAM_BUTTON = 'teams-member-add-to-team-button'
// a member row's selection circle, and the bar that shows while any member is selected
export const TEAMS_MEMBER_CHECK = 'teams-member-check'
export const TEAMS_SELECTION_POPUP = 'teams-selection-popup'
export const TEAMS_ROLE_PICKER = 'teams-role-picker'
// the add-members wizard's "Invite as:" role dropdown
export const TEAMS_WIZARD_ROLE_BUTTON = 'teams-wizard-role-button'
export const TEAMS_HEADER_MENU_BUTTON = 'teams-header-menu-button'
// the team page header's edit icon by the team's name (a subteam's rename)
export const TEAMS_HEADER_RENAME = 'teams-header-rename'
// the team page header's avatar, which opens the team avatar editor when you may change it
export const TEAMS_HEADER_AVATAR = 'teams-header-avatar'
// the delete-team confirm's three agreement switches
export const TEAMS_DELETE_TEAM_CHATS_CHECK = 'teams-delete-team-chats-check'
export const TEAMS_DELETE_TEAM_FOLDER_CHECK = 'teams-delete-team-folder-check'
export const TEAMS_DELETE_TEAM_NOTIFY_CHECK = 'teams-delete-team-notify-check'
export const TEAMS_CHANNEL_LIST = 'teams-channel-list'
export const TEAMS_CHANNEL_PAGE = 'teams-channel-page'
export const TEAMS_SETTINGS_TAB = 'teams-settings-tab'
export const TEAMS_BOTS_TAB     = 'teams-bots-tab'
// a bot's row menu (the ellipsis) in a team's Bots tab
export const TEAMS_BOT_ROW_MENU = 'teams-bot-row-menu'
// per-row buttons (one per row): a channel's edit and "..." menu, a member's, an invite's, a join
// request's and an emoji's "..." menu
export const TEAMS_CHANNEL_ROW_EDIT = 'teams-channel-row-edit'
export const TEAMS_CHANNEL_ROW_MENU = 'teams-channel-row-menu'
export const TEAMS_MEMBER_ROW_MENU = 'teams-member-row-menu'
export const TEAMS_INVITE_ROW_MENU = 'teams-invite-row-menu'
export const TEAMS_REQUEST_ROW_MENU = 'teams-request-row-menu'
export const TEAMS_EMOJI_ROW_MENU = 'teams-emoji-row-menu'
// a default channel pill's remove icon in the team settings (one per pill)
export const TEAMS_DEFAULT_CHANNEL_REMOVE = 'teams-default-channel-remove'
export const TEAMS_EMOJI_TAB = 'teams-emoji-tab'
// an emoji's row in a team's Emoji tab
export const TEAMS_EMOJI_ROW = 'teams-emoji-row'
// the phone's Add emoji screen's "Choose Images" button, which opens the photo picker
export const TEAMS_ADD_EMOJI_CHOOSE_IMAGES = 'teams-add-emoji-choose-images'
// its "Add emoji" button once images are picked (the Emoji tab under it has an Add emoji too)
export const TEAMS_ADD_EMOJI_SUBMIT = 'teams-add-emoji-submit'
// A settings switch or radio whose state the phone flows read (its control alone has none in the
// accessibility tree): its testID is one of the bases below, then what it shows, on or off, or
// pending while its value still loads or saves (what it shows then may not be the account's).
export const SETTING_ON = '-on'
export const SETTING_OFF = '-off'
export const SETTING_PENDING = '-pending'
export const settingTestID = (base: string, on: boolean, pending = false) =>
  `${base}${pending ? SETTING_PENDING : on ? SETTING_ON : SETTING_OFF}`
// the settings tab's "Feature team on your own profile" and "Don't allow requests to join this team"
// switches (settingTestID bases), and the message deletion dropdown (a team's settings tab, a
// conversation's info panel)
export const TEAMS_SETTINGS_FEATURE = 'teams-settings-feature'
export const TEAMS_SETTINGS_IGNORE_REQUESTS = 'teams-settings-ignore-requests'
export const TEAMS_RETENTION_DROPDOWN = 'teams-retention-dropdown'
// the "I understand..." switch of a destructive setting's warning (message deletion, open team)
export const TEAMS_CONFIRM_WARNING_CHECK = 'teams-confirm-warning-check'
// the Join a team dialog's "Token or team name" field
export const TEAMS_JOIN_TEAM_INPUT = 'teams-join-team-input'
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
// a team row on a member's page (it expands on a tap), and its role dropdown once expanded
export const TEAMS_MEMBER_TEAM_ROW = 'teams-member-team-row'
export const TEAMS_MEMBER_ROLE_BUTTON = 'teams-member-role-button'
// an external team's page once its public info (or the error saying there is none) has loaded
export const TEAMS_EXTERNAL_TEAM = 'teams-external-team'

// Devices
export const DEVICES_LIST = 'devices-list'
export const DEVICES_ROW  = 'devices-row'
export const DEVICE_PAGE  = 'device-page'
// last-used times: the service updates them while a device is in use
export const DEVICES_ROW_LAST_USED = 'devices-row-last-used'
export const DEVICE_PAGE_LAST_USED = 'device-page-last-used'
// the new paper key's words box on the devicePaperKey screen (flows hide it before any screenshot)
export const DEVICES_PAPER_KEY_WORDS = 'devices-paper-key-words'
// its "Yes, I wrote this down." switch (on the phone its label takes no tap)
export const DEVICES_PAPER_KEY_WROTE_IT_DOWN = 'devices-paper-key-wrote-it-down'

// Settings
export const SETTINGS_ACCOUNT           = 'settings-account'
// the account sub-page itself (SETTINGS_ACCOUNT is the settings nav that holds it)
export const SETTINGS_ACCOUNT_PAGE = 'settings-account-page'
export const SETTINGS_ADVANCED          = 'settings-advanced'
// Advanced's "Always stay logged in" switch (its toggle; shown only for an account with a password)
export const SETTINGS_REMEMBER_PASSWORD_SWITCH = 'settings-remember-password-switch'
export const SETTINGS_ABOUT             = 'settings-about'
export const SETTINGS_ARCHIVE           = 'settings-archive'
export const SETTINGS_CHAT              = 'settings-chat'
// the phone's Contacts page (Settings > Import phone contacts / Phone contacts)
export const SETTINGS_CONTACTS = 'settings-contacts'
// the chat settings' link preview lists and their Save button
export const SETTINGS_UNFURL_ALLOWED    = 'settings-unfurl-allowed'
export const SETTINGS_UNFURL_BLOCKED    = 'settings-unfurl-blocked'
export const SETTINGS_UNFURL_SAVE       = 'settings-unfurl-save'
// the chat settings' "who may message you" Save
export const SETTINGS_CONTACT_SAVE = 'settings-contact-save'
// the settings controls below are settingTestID bases (SETTING_ON)
// the chat settings' "Only let someone message you..." switch
export const SETTINGS_CONTACT_SWITCH = 'settings-contact-switch'
// a notification group's switch: the prefix, then the group ('security', 'email', ...), '-' and the
// setting's name
export const SETTINGS_NOTIFY_SWITCH_PREFIX = 'settings-notify-switch-'
// the link preview radios: the prefix, then the mode ('always', 'whitelisted', 'never')
export const SETTINGS_UNFURL_MODE_PREFIX = 'settings-unfurl-mode-'
// the iOS photos and videos radios: the prefix, then 'compressed' or 'original'
export const SETTINGS_COMPRESS_PREFIX = 'settings-compress-'
// Display's theme radios: the prefix, then 'system', 'alwaysDark' or 'alwaysLight'
export const SETTINGS_THEME_PREFIX = 'settings-theme-'
// Display's "Allow animated emoji" switch
export const SETTINGS_ANIMATED_EMOJI_SWITCH = 'settings-animated-emoji-switch'
// Advanced's lockdown mode switch
export const SETTINGS_LOCKDOWN_SWITCH = 'settings-lockdown-switch'
// Advanced's "Save Proxy Settings", with SETTING_PENDING after it until the proxy settings load
export const SETTINGS_PROXY_SAVE = 'settings-proxy-save'
// the add-email screen's address field, and an email row's gear (repeated per row)
export const SETTINGS_EMAIL_INPUT = 'settings-email-input'
export const SETTINGS_EMAIL_ROW_MENU = 'settings-email-row-menu'
// a Backup page job's row: the prefix, then the job's id
export const SETTINGS_ARCHIVE_ROW_PREFIX = 'settings-archive-row-'
export const SETTINGS_DISPLAY           = 'settings-display'
export const SETTINGS_FEEDBACK          = 'settings-feedback'
export const SETTINGS_FILES             = 'settings-files'
// the phone's Settings > Files: the low-space warning switch, its threshold dropdown and the
// mobile-network sync switch
export const SETTINGS_FILES_WARN_SWITCH = 'settings-files-warn-switch'
export const SETTINGS_FILES_THRESHOLD = 'settings-files-threshold'
export const SETTINGS_FILES_CELLULAR_SWITCH = 'settings-files-cellular-switch'
// Settings-list ROW testIDs (distinct from the subpage content above). Needed
// for Chat/Files because their row text collides with the bottom tab bar's
// "Chat"/"Files" tabs, making a text match ambiguous.
export const SETTINGS_ROW_CHAT          = 'settings-row-chat'
export const SETTINGS_ROW_FILES         = 'settings-row-files'
// the phone's Contacts row: its text, "Import phone contacts", is also the label of the page's button
export const SETTINGS_ROW_CONTACTS = 'settings-row-contacts'
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
// the Typography page's controls, which say what they show: the Dark background switch and each
// decoration button (the prefix, then the decoration) carry SETTING_ON or SETTING_OFF; the Next
// button carries the index of the sample shown after its prefix
export const SETTINGS_TYPOGRAPHY_DARK = 'settings-typography-dark'
export const SETTINGS_TYPOGRAPHY_DECORATION_PREFIX = 'settings-typography-decoration-'
export const SETTINGS_TYPOGRAPHY_NEXT_PREFIX = 'settings-typography-next-'
export const SETTINGS_ICONS = 'settings-icons'

// People
export const PEOPLE_FEED = 'people-feed'
export const PEOPLE_HEADER_AVATAR = 'people-header-avatar'
// the server-picked "Consider following..." users
export const PEOPLE_FOLLOW_SUGGESTIONS = 'people-follow-suggestions'
export const PEOPLE_FOLLOW_SUGGESTION = 'people-follow-suggestion'

// Profile
export const PROFILE_PAGE = 'profile-page'
// the profile's avatar and name, one element on the phone (its avatar has none of its own)
export const PROFILE_AVATAR_NAME = 'profile-avatar-name'
// the hover profile card's proof icons, drawn only once its identify is not checking
export const PROFILE_CARD_SERVICE_ICONS = 'profile-card-service-icons'
// a profile's "..." actions menu button, and a team row of its "Add to team..." picker (the id says
// whether the row is picked)
export const PROFILE_ACTIONS_MENU = 'profile-actions-menu'
export const PROFILE_ADD_TO_TEAM_ROW = 'profile-add-to-team-row'
export const PROFILE_ADD_TO_TEAM_ROW_CHECKED = 'profile-add-to-team-row-checked'
// Edit profile's fields
export const PROFILE_EDIT_FULL_NAME = 'profile-edit-full-name'
export const PROFILE_EDIT_BIO = 'profile-edit-bio'
export const PROFILE_EDIT_LOCATION = 'profile-edit-location'
// the Follow / Follow back / Following button
export const PROFILE_FOLLOW_BUTTON = 'profile-follow-button'
// an identity row's status icon, which opens its menu (repeated per row)
export const PROFILE_ASSERTION_MENU = 'profile-assertion-menu'
// the proofs list's "Search N platforms" filter
export const PROFILE_PROOFS_FILTER = 'profile-proofs-filter'

// Git
export const GIT_REPO_LIST = 'git-repo-list'
export const GIT_REPO_ROW  = 'git-repo-row'
// the phone's "New encrypted git repository..." button, an expanded repo's clone URL copy button and
// its "Announce pushes in" checkbox
export const GIT_NEW_REPO = 'git-new-repo'
export const GIT_REPO_COPY_URL = 'git-repo-copy-url'
export const GIT_REPO_ANNOUNCE = 'git-repo-announce'
// the new team repository screen's team dropdown (its label merges the team picked, or its prompt)
export const GIT_NEW_TEAM_DROPDOWN = 'git-new-team-dropdown'
// the "Notify the team" checkbox of the new team repository screen and of the delete screen
// (settingTestID bases)
export const GIT_NEW_NOTIFY = 'git-new-notify'
export const GIT_DELETE_NOTIFY = 'git-delete-notify'

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
// The recipients field is a display-only input inside a pointerEvents="none"
// wrapper, so only this outer clickable can receive a click.
export const CRYPTO_RECIPIENTS    = 'crypto-recipients'
// The text field itself (the Input3), inside the screen's clickable input box.
export const CRYPTO_TEXT_INPUT    = 'crypto-text-input'

// A desktop floating menu (message "..." menu, header menus); mobile menus are bottom sheets
export const FLOATING_MENU = 'floating-menu'

// The desktop app's other windows (desktop/remote)
export const MENUBAR_MENU_BUTTON = 'menubar-menu-button'
// a folder's row in the widget's recent files, there once its edit history has loaded
export const MENUBAR_TLF_ROW = 'menubar-tlf-row'
// a file's row under its folder in the widget's recent files
export const MENUBAR_FILE_ROW = 'menubar-file-row'
// the widget header's tab icons
export const MENUBAR_TAB_CHAT = 'menubar-tab-chat'
export const MENUBAR_TAB_FILES = 'menubar-tab-files'
export const PINENTRY = 'pinentry'
// the tracker popup's buttons, there once the identify has a result (for yourself, at once)
export const TRACKER_BUTTONS = 'tracker-buttons'
export const UNLOCK_FOLDERS_DEVICES = 'unlock-folders-devices'
export const UNLOCK_FOLDERS_PAPER_KEY_BUTTON = 'unlock-folders-paper-key-button'
export const UNLOCK_FOLDERS_PAPER_KEY_INPUT = 'unlock-folders-paper-key-input'

// Common — keep value matching existing testID="backButton" in .maestro subflows
export const COMMON_BACK_BUTTON = 'backButton'
// the phone search filter's X, which clears it or, where the filter has a cancel, ends its search
export const SEARCH_FILTER_CLEAR = 'search-filter-clear'
// the phone search filter's box: one accessible element on iOS, so its text field is not in the tree
export const SEARCH_FILTER = 'search-filter'
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
// a person row in the team builder's recommendations or search results
export const TEAM_BUILDING_RESULT_ROW = 'team-building-result-row'
// the bot search's results: the users it found and the featured bots
export const CHAT_BOT_SEARCH_RESULTS = 'chat-bot-search-results'
// the local database nuke confirmation (a debug page in settings)
export const SETTINGS_DB_NUKE_CONFIRM = 'settings-db-nuke-confirm'
// the page a bad keybase:// link opens
export const KEYBASE_LINK_ERROR = 'keybase-link-error'
// the paper key form (chat's rekey prompt and provisioning)
export const PAPER_KEY_FORM = 'paper-key-form'
// the login screen's list of the accounts on this device
export const LOGIN_USER_LIST = 'login-user-list'
// the login screen's password field (shown for an account with no stored secret)
export const LOGIN_PASSWORD_INPUT = 'login-password-input'
// the new-password field of Settings' change/set password screen
export const SETTINGS_NEW_PASSWORD_INPUT = 'settings-new-password-input'
// ... and its confirm field
export const SETTINGS_CONFIRM_PASSWORD_INPUT = 'settings-confirm-password-input'
// the signed-out screens' fields: signup's username, policy checkbox (its toggle on the phone) and
// device name, the username screen "Someone else..." opens, Recover username's email, and the
// paper key a password recovery asks for
export const SIGNUP_USERNAME_INPUT = 'signup-username-input'
export const SIGNUP_EULA_CHECKBOX = 'signup-eula-checkbox'
export const SIGNUP_DEVICE_NAME_INPUT = 'signup-device-name-input'
export const PROVISION_USERNAME_INPUT = 'provision-username-input'
export const FORGOT_USERNAME_EMAIL_INPUT = 'forgot-username-email-input'
export const RECOVER_PASSWORD_PAPER_KEY_INPUT = 'recover-password-paper-key-input'

// Debug overlays: the global error bar and the runtime stats the service sends when turned on
export const GLOBAL_ERROR = 'global-error'
// the overlay the main window shows while it has no connection to the service
export const DISCONNECT_OVERLAY = 'disconnect-overlay'
export const RUNTIME_STATS = 'runtime-stats'

// A row of the account switcher sheet and of the login screen's account list, each followed by the
// account's username
export const ACCOUNT_SWITCHER_ROW_PREFIX = 'account-switcher-row-'
export const LOGIN_USER_ROW_PREFIX = 'login-user-row-'
// the provisioning code page's container, whichever tab (QR, view or enter the phrase) it shows
export const PROVISION_CODE_PAGE = 'provision-code-page'
