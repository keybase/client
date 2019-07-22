import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SignupGen from '../../actions/signup-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import * as Constants from '../../constants/signup'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {anyWaiting} from '../../constants/waiting'
import EnterUsername from '.'
import {InfoIcon} from '../common'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => ({
  _users: state.config.configuredAccounts,
  error: state.signup.usernameError,
  initialUsername: state.signup.username,
  usernameTaken: state.signup.usernameTaken,
  waiting: anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onBack: () => {
    dispatch(SignupGen.createRestartSignup())
    dispatch(RouteTreeGen.createNavigateUp())
  },
  _onReturnToMain: () => {
    dispatch(RouteTreeGen.createSwitchLoggedIn({loggedIn: true}))
  },
  onContinue: (username: string) => dispatch(SignupGen.createCheckUsername({username})),
  onLogin: (initUsername: string) => dispatch(ProvisionGen.createStartProvision({initUsername})),
})

const ConnectedEnterUsername = Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o: OwnProps) => ({
    ...s,
    ...d,
    ...o,
    onBack: s._users.some(account => account.hasStoredSecret) ? d._onReturnToMain : d._onBack,
  })
)(EnterUsername)

// @ts-ignore fix this
ConnectedEnterUsername.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
  headerRightActions: () => (
    <Kb.Box2
      direction="horizontal"
      style={Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0)}
    >
      <InfoIcon />
    </Kb.Box2>
  ),
}

export default ConnectedEnterUsername
