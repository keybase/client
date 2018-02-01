// @flow
import * as React from 'react'
import {stringToDeviceID} from '../constants/types/devices'
import {action, storiesOf, createPropProvider} from '../stories/storybook'
import Devices, {type Props} from '.'

const devicesProps: Props = {
  deviceIDs: ['1', '2', '3'].map(stringToDeviceID),
  menuItems: [
    {onClick: action('onAdd phone'), title: 'New phone'},
    {onClick: action('onAdd computer'), title: 'New computer'},
    {onClick: action('onAdd paper key'), title: 'New paper key'},
  ],
  onToggleShowRevoked: action('onToggleShowRevoked'),
  showingRevoked: false,
  revokedDeviceIDs: ['4', '5'].map(stringToDeviceID),
  showMenu: action('showMenu'),
  hideMenu: action('hideMenu'),
  showingMenu: false,
  waiting: false,
}
const provider = createPropProvider({
  DeviceRow: (props: {deviceID: string}) => ({
    isCurrentDevice: props.deviceID === '1',
    name: {'1': 'laptop', '2': 'phone', '3': 'hello robot', '4': 'dog party', '5': 'desktop'}[props.deviceID],
    isRevoked: !['1', '2', '3'].includes(props.deviceID),
    icon: {
      '1': 'icon-computer-48',
      '2': 'icon-phone-48',
      '3': 'icon-paper-key-48',
      '4': 'icon-paper-key-48',
      '5': 'icon-computer-48',
    }[props.deviceID],
    showExistingDevicePage: action('onShowExistingDevicePage'),
  }),
})

const load = () => {
  storiesOf('Devices', module)
    .addDecorator(provider)
    .add('Only active', () => <Devices {...devicesProps} />)
    .add('Showing revoked', () => <Devices {...devicesProps} showingRevoked={true} />)
}

export default load
