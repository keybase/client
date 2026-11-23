// Named subsets of the tour, picked with --suite <name>. Each pattern is an id or glob like a
// positional; one with no entry on the run's platform is skipped there, but each must name an
// entry on some platform (suites.test.mts).
export const SUITES = {
  // The shared layout pieces: screen containers and side insets, headers, the chat and settings
  // splits, bottom sheets and modals. One or two screens per area, not every menu or variant.
  layout: [
    // tab roots: the screen container, scrolling lists and the tab bar
    'tab/*',
    // chat: thread header and composer, pinned banner, search, info panel, sheets, fullscreen
    'chat/e2e-short',
    'chat/unpin-prompt',
    'chat/thread-search',
    'chat/message-menu',
    'chat/info-panel',
    'chat/info-panel-attachments',
    'chat/info-panel-menu',
    'chat/attachment-fullscreen',
    // pages with their own header or side margins
    'profile/self',
    'profile/other',
    'files/private',
    'files/text',
    'files/preview',
    'crypto/encrypt',
    'modal/crypto-encrypt-output',
    'devices/page',
    'team/members',
    'team/menu',
    // settings: the list beside the page, and pages inside it
    'settings/account',
    'settings/advanced',
    'settings/chat',
    'settings/display',
    // Android: the screen protector blanks captures, and the run lifts it everywhere else
    'settings/screen-protector-on',
    // modals: form sheets, full-bleed backgrounds, centered ones
    'modal/settings-password',
    'modal/team-edit-info',
    'modal/team-new',
    'modal/device-add',
    'modal/chat-pdf',
    'overlay/global-error',
  ],
} as const satisfies Record<string, ReadonlyArray<string>>

export type SuiteName = keyof typeof SUITES

export const SUITE_NAMES = Object.keys(SUITES) as ReadonlyArray<SuiteName>
export const isSuiteName = (s: string): s is SuiteName => (SUITE_NAMES as ReadonlyArray<string>).includes(s)
