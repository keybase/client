import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import * as Constants from '../../../../constants/wallets'
import * as Types from '../../../../constants/types/wallets'
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
  onSecretKeySeen: Sb.action('onSecretKeySeen'),
  waiting: false,
}

const inflationDestSDF = Constants.makeAccountInflationDestination({
  accountID: Types.stringToAccountID('SDF'),
  name: 'The Stellar Development Foundation',
})
const inflationDestOther = Constants.makeAccountInflationDestination({
  accountID: Types.stringToAccountID('OTHERADDRESS'),
  name: '',
})
const inflationProps = {
  error: '',
  inflationDestination: Constants.noAccountInflationDestination,
  onClose: Sb.action('onClose'),
  onSubmit: Sb.action('onSubmit'),
  options: [
    {
      address: Types.stringToAccountID('L'),
      link: 'keybase.io/lumenaut',
      name: 'Lumenaut',
      recommended: true,
    },
    {
      address: inflationDestSDF.accountID,
      link: 'keybase.io/sdf',
      name: 'The Stellar Development Foundation',
      recommended: false,
    },
    {address: Types.stringToAccountID('K'), link: '', name: 'Keybase', recommended: false},
  ],
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
    .add('Inflation destination error', () => (
      <InflationDestination
        {...inflationProps}
        error="something something something something something something something something something something something something went wrong"
      />
    ))
    .add('Inflation destination sdf', () => (
      <InflationDestination {...inflationProps} inflationDestination={inflationDestSDF} />
    ))
    .add('Inflation destination no lumenaut', () => (
      <InflationDestination
        {...inflationProps}
        inflationDestination={inflationDestOther}
        options={inflationProps.options.filter(o => o.name !== 'Lumenaut')}
      />
    ))
}

export default load
