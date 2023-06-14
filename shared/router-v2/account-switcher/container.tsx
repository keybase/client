import * as ConfigGen from '../../actions/config-gen'
import * as ConfigConstants from '../../constants/config'
import * as Container from '../../util/container'
import * as LoginConstants from '../../constants/login'
import * as LoginGen from '../../actions/login-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsConstants from '../../constants/settings'
import * as TrackerConstants from '../../constants/tracker2'
import AccountSwitcher from './index'
import HiddenString from '../../util/hidden-string'

const prepareAccountRows = <T extends {username: string; hasStoredSecret: boolean}>(
  accountRows: Array<T>,
  myUsername: string
): Array<T> => accountRows.filter(account => account.username !== myUsername)

export default () => {
  const _fullnames = Container.useSelector(state => state.users.infoMap)
  const _accountRows = ConfigConstants.useConfigState(s => s.configuredAccounts)
  const you = ConfigConstants.useCurrentUserState(s => s.username)
  const fullname = Container.useSelector(state => TrackerConstants.getDetails(state, you).fullname || '')
  const waiting = Container.useAnyWaiting(LoginConstants.waitingKey)

  const dispatch = Container.useDispatch()
  const _onProfileClick = (username: string) => {
    dispatch(ProfileGen.createShowUserProfile({username}))
  }
  const onAddAccount = () => {
    dispatch(ProvisionGen.createStartProvision())
  }
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onSelectAccountLoggedIn = (username: string) => {
    dispatch(ConfigGen.createSetUserSwitching({userSwitching: true}))
    dispatch(LoginGen.createLogin({password: new HiddenString(''), username}))
  }
  const onSelectAccountLoggedOut = (username: string) => {
    dispatch(ConfigGen.createLogoutAndTryToLogInAs({username}))
  }
  const onSignOut = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsConstants.logOutTab]}))
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
      const loggedIn = rows.length && rows[0].hasStoredSecret
      return loggedIn ? onSelectAccountLoggedIn(username) : onSelectAccountLoggedOut(username)
    },
    onSignOut: onSignOut,
    username: you,
    waiting: waiting,
  }
  return <AccountSwitcher {...props} />
}
