// @flow
import * as React from 'react'
import {stringToDeviceID} from '../constants/types/devices'
import {action, storiesOf, createPropProvider} from '../stories/storybook'
import Devices, {type Props} from '.'
import DevicePage from './device-page/container'

const devicesProps: Props = {
  deviceIDs: ['1', '2', '3'].map(stringToDeviceID),
  hideMenu: action('hideMenu'),
  menuItems: [
    {onClick: action('onAdd phone'), title: 'New phone'},
    {onClick: action('onAdd computer'), title: 'New computer'},
    {onClick: action('onAdd paper key'), title: 'New paper key'},
  ],
  onToggleShowRevoked: action('onToggleShowRevoked'),
  revokedDeviceIDs: ['4', '5'].map(stringToDeviceID),
  showMenu: action('showMenu'),
  showingMenu: false,
  showingRevoked: false,
  waiting: false,
}
const provider = createPropProvider({
  DevicePage: (props: {revoked: boolean, type: string, current: boolean, timeLen: ?number}) => ({
    currentDevice: !!props.current,
    deviceID: '123',
    icon: {
      backup: 'icon-paper-key-64',
      desktop: 'icon-computer-64',
      mobile: 'icon-phone-64',
    }[props.type],
    name: `My ${props.type}`,
    onBack: action('onback'),
    revokeName: {
      backup: 'paper key',
      desktop: 'device',
      mobile: 'device',
    }[props.type],
    revokedAt: props.revoked ? new Date('2002-10-11T01:23:45') : null,
    showRevokeDevicePage: props.revoked ? null : action('onrevoke'),
    timeline: [
      {desc: 'Revoked whenever', subDesc: 'whomever', type: 'Revoked'},
      {desc: 'Last used whenever', subDesc: 'whenever', type: 'LastUsed'},
      {desc: 'Added whenever', subDesc: 'provisioner', type: 'Added'},
    ].slice(0, props.timeLen || 0),
    type: props.type,
  }),
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

const commonPageProps = {
  routeProps: {get: (_: any): any => 123},
}

const load = () => {
  storiesOf('Devices/List', module)
    .addDecorator(provider)
    .add('Only active', () => <Devices {...devicesProps} />)
    .add('Showing revoked', () => <Devices {...devicesProps} showingRevoked={true} />)
  storiesOf('Devices/Device', module)
    .addDecorator(provider)
    .add('Desktop', () => <DevicePage type="desktop" timeLen={1} {...commonPageProps} />)
    .add('Desktop current', () => (
      <DevicePage type="desktop" timeLen={2} current={true} {...commonPageProps} />
    ))
    .add('Desktop Revoked', () => (
      <DevicePage type="desktop" timeLen={3} revoked={true} {...commonPageProps} />
    ))
    .add('Mobile', () => <DevicePage type="mobile" {...commonPageProps} />)
    .add('Mobile Revoked', () => <DevicePage type="mobile" revoked={true} {...commonPageProps} />)
    .add('Paper key', () => <DevicePage type="backup" {...commonPageProps} />)
    .add('Paper key Revoked', () => <DevicePage type="backup" revoked={true} {...commonPageProps} />)
}

export default load
