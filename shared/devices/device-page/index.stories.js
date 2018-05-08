// @flow
import * as React from 'react'
import {action, storiesOf, createPropProvider} from '../../stories/storybook'
import DevicePage from './container'

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
})

const commonPageProps = {
  routeProps: {get: (_: any): any => 123},
}

const load = () => {
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
