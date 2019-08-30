import * as LoginGen from '../../actions/login-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsConstants from '../../constants/settings'
import * as TrackerConstants from '../../constants/tracker2'
import AccountSwitcher, {Props} from './index'
import * as Container from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import * as SignupGen from '../../actions/signup-gen'
import * as Constants from '../../constants/config'
import HiddenString from '../../util/hidden-string'

type OwnProps = {}

export default Container.connect(
  state => ({
    _fullnames: state.users.infoMap,
    accountRows: state.config.configuredAccounts,
    fullname: TrackerConstants.getDetails(state, state.config.username).fullname || '',
    username: state.config.username,
  }),
  dispatch => ({
    _onProfileClick: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
    onAddAccount: () => dispatch(ProvisionGen.createStartProvision()),
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onCreateAccount: () => dispatch(SignupGen.createRequestAutoInvite()),
    onSelectAccountLoggedIn: (username: string) =>
      dispatch(LoginGen.createLogin({password: new HiddenString(''), username})),
    onSelectAccountLoggedOut: (username: string) => {
      dispatch(ConfigGen.createSetDefaultUsername({username}))
      dispatch(RouteTreeGen.createSwitchLoggedIn({loggedIn: false}))
    },
    onSignOut: () => dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsConstants.logOutTab]})),
  }),
  (stateProps, dispatchProps, _: OwnProps): Props => {
    const accountRows = Constants.prepareAccountRows(stateProps.accountRows, stateProps.username)
    return {
      accountRows: accountRows
        .map(account => ({
          account: account,
          fullName: stateProps._fullnames.get(account.username, {fullname: ''}).fullname,
        }))
        .toArray(),
      fullname: stateProps.fullname,
      onAddAccount: dispatchProps.onAddAccount,
      onCancel: dispatchProps.onCancel,
      onCreateAccount: dispatchProps.onCreateAccount,
      onProfileClick: () => dispatchProps._onProfileClick(stateProps.username),
      onSelectAccount: (username: string) => {
        const rows = accountRows.filter(account => account.username === username)
        const loggedIn = rows.first({hasStoredSecret: false}).hasStoredSecret
        return loggedIn
          ? dispatchProps.onSelectAccountLoggedIn(username)
          : dispatchProps.onSelectAccountLoggedOut(username)
      },
      rightActions: [
        {
          color: 'red',
          label: 'Sign out',
          onPress: dispatchProps.onSignOut,
        },
      ],

      title: ' ',
      username: stateProps.username,
    }
  }
)(AccountSwitcher)
