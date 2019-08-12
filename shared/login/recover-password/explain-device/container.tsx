import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as RecoverPasswordGen from '../../../actions/recover-password-gen'
import DeviceSelector from '.'
import {InfoIcon} from '../../../signup/common'

type OwnProps = {}

const ConnectedExplainDevice = Container.connect(
  state => {
    const ed = state.recoverPassword.explainedDevice
    return {
      deviceName: ed ? ed.name : '',
      deviceType: ed ? ed.type : '',
      username: state.recoverPassword.username,
    }
  },
  dispatch => ({
    _onBack: username =>
      dispatch(
        RecoverPasswordGen.createStartRecoverPassword({
          username: username,
        })
      ),
    onComplete: () => {
      dispatch(RouteTreeGen.createNavigateUp())
    },
  }),
  (s, d, o: OwnProps) => ({
    ...o,
    ...s,
    ...d,
    onBack: () => d._onBack(s.username),
  })
)(DeviceSelector)

// @ts-ignore fix this
ConnectedExplainDevice.navigationOptions = {
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

export default ConnectedExplainDevice
