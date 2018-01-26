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
  revokedDeviceIDs: [],
  showMenu: action('showMenu'),
  hideMenu: action('hideMenu'),
  showingMenu: false,
  waiting: false,
}
const provider = createPropProvider({
  DeviceRow: (props: {deviceID: string}) => ({
    isCurrentDevice: props.deviceID === '1',
    name: {'1': 'laptop', '2': 'phone', '3': 'hello robot'}[props.deviceID],
    isRevoked: false,
    icon: 'icon-paper-key-48',
    showExistingDevicePage: action('onShowExistingDevicePage'),
  }),
})

const load = () => {
  storiesOf('Devices', module)
    .addDecorator(provider)
    .add('Simple', () => <Devices {...devicesProps} />)
}

export default load
