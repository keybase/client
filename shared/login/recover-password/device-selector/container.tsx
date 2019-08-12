import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as RecoverPasswordGen from '../../../actions/recover-password-gen'
import DeviceSelector from '.'
import {InfoIcon} from '../../../signup/common'

type OwnProps = {}

const ConnectedDeviceSelector = Container.connect(
  state => ({
    devices: state.recoverPassword.devices.toArray(),
  }),
  dispatch => ({
    _onSelect: (id: string) => dispatch(RecoverPasswordGen.createSubmitDeviceSelect({id})),
    onBack: () => dispatch(RecoverPasswordGen.createAbortDeviceSelect()),
    onResetAccount: () => dispatch(RecoverPasswordGen.createSubmitDeviceSelect({id: ''})),
  }),
  (s, d, o: OwnProps) => ({
    ...o,
    ...s,
    onBack: d.onBack,
    onResetAccount: d.onResetAccount,
    onSelect: (name: string) => {
      const device = s.devices.find(device => device.name === name)
      d._onSelect(device ? device.id : '')
    },
  })
)(DeviceSelector)

// @ts-ignore fix this
ConnectedDeviceSelector.navigationOptions = {
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

export default ConnectedDeviceSelector
