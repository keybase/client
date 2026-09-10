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

export const peekPendingAccountSwitchTab = (currentUsername: string) =>
  pendingAccountSwitch?.targetUsername === currentUsername ? pendingAccountSwitch.tab : undefined

export const consumePendingAccountSwitchTab = (currentUsername: string) => {
  const pending = pendingAccountSwitch
  if (pending?.targetUsername !== currentUsername) return
  pendingAccountSwitch = undefined
  return pending.tab
}

// Whether the root navigator shows the logged-in screens. A switch that starts while logged in flaps
// loggedIn false and back between the service's loggedOut and loggedIn notifications. Following
// that would swap the native root stack to loggedOut and back right before the navKey remount, and
// that churn leaves RNS screens from the unmounted navigator on screen, swallowing every touch. So
// hold the logged-in screens through such a switch. A switch that starts logged out (e.g. a
// notification tap on the login screen) keeps the logged-out screens until it lands.
export const showLoggedInScreens = (s: {
  loggedIn: boolean
  userSwitching: boolean
  userSwitchingFromLoggedIn: boolean
}) => s.loggedIn || (s.userSwitching && s.userSwitchingFromLoggedIn)

export const clearPendingAccountSwitch = (currentUsername: string) => {
  if (pendingAccountSwitch?.targetUsername !== currentUsername) {
    pendingAccountSwitch = undefined
  }
}
