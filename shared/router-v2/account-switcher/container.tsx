import * as C from '@/constants'
import * as ConfigConstants from '@/constants/config'
import * as TrackerConstants from '@/constants/tracker2'
import AccountSwitcher from './index'

const prepareAccountRows = <T extends {username: string; hasStoredSecret: boolean}>(
  accountRows: Array<T>,
  myUsername: string
): Array<T> => accountRows.filter(account => account.username !== myUsername)

const Container = () => {
  const _fullnames = C.useUsersState(s => s.infoMap)
  const _accountRows = C.useConfigState(s => s.configuredAccounts)
  const you = C.useCurrentUserState(s => s.username)
  const fullname = C.useTrackerState(s => TrackerConstants.getDetails(s, you).fullname || '')
  const waiting = C.useAnyWaiting(ConfigConstants.loginWaitingKey)
  const _onProfileClick = C.useProfileState(s => s.dispatch.showUserProfile)
  const onAddAccount = C.useProvisionState(s => s.dispatch.startProvision)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }

  const setUserSwitching = C.useConfigState(s => s.dispatch.setUserSwitching)
  const login = C.useConfigState(s => s.dispatch.login)
  const onSelectAccountLoggedIn = (username: string) => {
    setUserSwitching(true)
    login(username, '')
  }
  const onSelectAccountLoggedOut = C.useConfigState(s => s.dispatch.logoutAndTryToLogInAs)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onSignOut = () => {
    navigateAppend(C.settingsLogOutTab)
  }
  const accountRows = prepareAccountRows(_accountRows, you)
  const props = {
    accountRows: accountRows.map(account => ({
      account: account,
      fullName: (_fullnames.get(account.username) || {fullname: ''}).fullname || '',
    })),
    fullname: fullname,
    onAddAccount: onAddAccount,
    onCancel: onCancel,
    onProfileClick: () => _onProfileClick(you),
    onSelectAccount: (username: string) => {
      const rows = accountRows.filter(account => account.username === username)
      const loggedIn = (rows.length && rows[0]?.hasStoredSecret) ?? false
      return loggedIn ? onSelectAccountLoggedIn(username) : onSelectAccountLoggedOut(username)
    },
    onSignOut: onSignOut,
    username: you,
    waiting: waiting,
  }
  return <AccountSwitcher {...props} />
}

export default Container
