import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SignupGen from '../../actions/signup-gen'
import * as Constants from '../../constants/signup'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {anyWaiting} from '../../constants/waiting'
import EnterUsername from '.'
import {InfoIcon} from '../common'

type OwnProps = {}

const mapStateToProps = state => ({
  usernameTaken: state.signup.usernameTaken,
  waiting: anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onContinue: (username: string) => dispatch(SignupGen.createCheckUsername({username})),
  onLogin: (username: string) => {
    /* TODO */
  },
})

const ConnectedEnterUsername = Container.connect(mapStateToProps, mapDispatchToProps)(EnterUsername)

// @ts-ignore fix this
ConnectedEnterUsername.navigationOptions = {
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
