import * as React from 'react'
import * as Container from '../../util/container'
import * as SignupGen from '../../actions/signup-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/signup'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {anyWaiting} from '../../constants/waiting'
import {InfoIcon} from '../common'
import EnterDevicename from '.'

const mapStateToProps = state => ({
  initialDevicename: state.signup.devicename,
  waiting: anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onContinue: (devicename: string) => dispatch(SignupGen.createCheckDevicename({devicename})),
})

const ConnectedEnterDevicename = Container.connect(mapStateToProps, mapDispatchToProps)(EnterDevicename)

// @ts-ignore fix this
ConnectedEnterDevicename.navigationOptions = {
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

export default ConnectedEnterDevicename
