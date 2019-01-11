// @flow
import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import RemoveAccountPopup from './remove-account'
import ReallyRemoveAccountPopup from './really-remove-account'
import SetDefaultAccountPopup from './set-default'
import InflationDestination from './inflation-destination'

const warningProps = {
  balance: '0.00 XLM',
  name: 'awesome account',
  onClose: Sb.action('onClose'),
  onDelete: Sb.action('onDelete'),
}

const reallyProps = {
  loading: false,
  name: 'awesome account',
  onCancel: Sb.action('onCancel'),
  onCopyKey: Sb.action('onCopyKey'),
  onFinish: Sb.action('onFinish'),
  onLoadSecretKey: Sb.action('onLoadSecretKey'),
  waiting: false,
}

const inflationProps = {
  options: [
    {name: 'Lumenaut', address: 'L', recommended: true, link: 'keybase.io/lumenaut'},
    {name: 'The Stellar Development Foundation', address: 'SDF', recommended: false, link: 'keybase.io/sdf'},
    {name: 'Keybase', address: 'K', recommended: false},
  ],
  onSubmit: Sb.action('onSubmit'),
  onClose: Sb.action('onClose'),
}

const load = () => {
  Sb.storiesOf('Wallets/Wallet/Settings/Popups', module)
    .add('Remove account', () => <RemoveAccountPopup {...warningProps} />)
    .add('Remove account (long name)', () => (
      <RemoveAccountPopup {...warningProps} name="GA55UT7Z63R7WU2U26WMC6NZKH3AOWJWNTQQQHWDZRCWUQPXHBTDCD72" />
    ))
    .add('Really remove account', () => <ReallyRemoveAccountPopup {...reallyProps} />)
    .add('Really remove account (Loading)', () => (
      <ReallyRemoveAccountPopup {...reallyProps} loading={true} />
    ))
    .add('Really remove account (long name)', () => (
      <ReallyRemoveAccountPopup
        {...reallyProps}
        name="GA55UT7Z63R7WU2U26WMC6NZKH3AOWJWNTQQQHWDZRCWUQPXHBTDCD72"
      />
    ))
    .add('Set as default popup', () => (
      <SetDefaultAccountPopup
        accountName="Second account"
        onAccept={Sb.action('onAccept')}
        onClose={Sb.action('onClose')}
        username="cecileb"
        waiting={false}
      />
    ))
    .add('Inflation destination normal', () => <InflationDestination {...inflationProps} />)
    .add('Inflation destination no lumenaut', () => (
      <InflationDestination
        {...inflationProps}
        options={inflationProps.options.filter(o => o.name !== 'Lumenaut')}
      />
    ))
}

export default load
