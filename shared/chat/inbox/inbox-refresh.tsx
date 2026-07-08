import type * as T from '@/constants/types'

// Dependency-free indirection so constants/router can trigger an inbox-layout
// refresh without statically importing chat/inbox/layout-state (which imports
// stores/config, which imports constants/router). layout-state registers its
// refresh dispatch at store-creation time; callers invoke refreshInboxLayout.
let _refresh: ((reason: T.Chat.RefreshReason) => void) | undefined

export const registerInboxRefresh = (f: (reason: T.Chat.RefreshReason) => void) => {
  _refresh = f
}

export const refreshInboxLayout = (reason: T.Chat.RefreshReason) => {
  _refresh?.(reason)
}
