import type * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'

// The service returns configured accounts in descending login-time order, so
// the first eligible account is the most recently used account other than the
// current one.
export const getMostRecentlyUsedAccount = (
  accounts: ReadonlyArray<T.Config.ConfiguredAccount>,
  currentUsername: string
) => accounts.find(account => account.username !== currentUsername && account.hasStoredSecret)

type PendingAccountSwitch = {
  targetUsername: string
  tab: Tabs.AppTab
}

let pendingAccountSwitch: PendingAccountSwitch | undefined

const isAppTab = (tab: Tabs.Tab | undefined): tab is Tabs.AppTab =>
  tab !== undefined && Tabs.desktopTabs.some(appTab => appTab === tab)

export const rememberAccountSwitchTab = (
  sourceUsername: string,
  targetUsername: string,
  tab: Tabs.Tab | undefined
) => {
  pendingAccountSwitch =
    sourceUsername && targetUsername && sourceUsername !== targetUsername && isAppTab(tab)
      ? {tab, targetUsername}
      : undefined
}

export const consumePendingAccountSwitchTab = (currentUsername: string) => {
  const pending = pendingAccountSwitch
  if (pending?.targetUsername !== currentUsername) return
  pendingAccountSwitch = undefined
  return pending.tab
}

export const clearPendingAccountSwitch = (currentUsername: string) => {
  if (pendingAccountSwitch?.targetUsername !== currentUsername) {
    pendingAccountSwitch = undefined
  }
}
