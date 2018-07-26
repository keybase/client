// @flow
import * as React from 'react'
import {stringToDeviceID} from '../constants/types/devices'
import {action, storiesOf, createPropProvider} from '../stories/storybook'
import Devices, {type Props} from '.'
import devicePage from './device-page/index.stories'
import deviceRevoke from './device-revoke/index.stories'

const devicesProps: Props = {
  hideMenu: action('hideMenu'),
  items: [
    {id: stringToDeviceID('1'), key: '1', type: 'device'},
    {id: stringToDeviceID('2'), key: '2', type: 'device'},
    {id: stringToDeviceID('3'), key: '3', type: 'device'},
  ],
  loadDevices: action('loaddevices'),
  menuItems: [
    {onClick: action('onAdd phone'), title: 'New phone'},
    {onClick: action('onAdd computer'), title: 'New computer'},
    {onClick: action('onAdd paper key'), title: 'New paper key'},
  ],
  revokedItems: [
    {id: stringToDeviceID('4'), key: '4', type: 'device'},
    {id: stringToDeviceID('5'), key: '5', type: 'device'},
  ],
  showMenu: action('showMenu'),
  showingMenu: false,
  waiting: false,
}

const provider = createPropProvider({
  DeviceRow: (props: {deviceID: string}) => ({
    icon: {
      '1': 'icon-computer-48',
      '2': 'icon-phone-48',
      '3': 'icon-paper-key-48',
      '4': 'icon-paper-key-48',
      '5': 'icon-computer-48',
    }[props.deviceID],
    isCurrentDevice: props.deviceID === '1',
    isRevoked: !['1', '2', '3'].includes(props.deviceID),
    name: {'1': 'laptop', '2': 'phone', '3': 'hello robot', '4': 'dog party', '5': 'desktop'}[props.deviceID],
    showExistingDevicePage: action('onShowExistingDevicePage'),
  }),
})

const load = () => {
  devicePage()
  deviceRevoke()
  storiesOf('Devices/List', module)
    .addDecorator(provider)
    .add('Only active', () => <Devices {...devicesProps} />)
    .add('Showing revoked', () => <Devices {...devicesProps} showingRevoked={true} />)
}

export default load
