import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import Settings from '.'
import popups from './popups/index.stories'
import * as Types from '../../../constants/types/wallets'
import * as Constants from '../../../constants/wallets'
import * as I from 'immutable'

const testCurrencies = I.List([
  {
    code: 'USD',
    description: 'USD ($)',
    name: 'US Dollar',
    symbol: '$',
  },
  {
    code: 'XLLM',
    description: 'XLM',
    name: 'Lumens',
    symbol: 'XLM',
  },
  {
    code: 'CAD',
    description: 'CAD ($)',
    name: 'Canadian Dollar',
    symbol: '$',
  },
  {
    code: 'EUR',
    description: 'EUR (€)',
    name: 'Euro',
    symbol: '€',
  },
  {
    code: 'GPB',
    description: 'GBP (£)',
    name: 'British Pount',
    symbol: '£',
  },
]).map(c => Constants.currencyResultToCurrency(c))

const externalPartner = {
  adminOnly: false,
  description: 'Example description.',
  extra: 'Example extra.',
  iconFilename: '',
  showDivider: false,
  title: 'Example title.',
  url: 'https://example.com/%{accountId}',
}
const externalPartners = [externalPartner, {...externalPartner, showDivider: true}]

const sharedSettingsProps = {
  accountID: Types.noAccountID,
  canSubmitTx: true,
  currencies: testCurrencies,
  currencyWaiting: false,
  externalPartners,
  inflationDestination: '',
  mobileOnlyEditable: false,
  mobileOnlyMode: false,
  mobileOnlyWaiting: false,
  onBack: Sb.action('onBack'),
  onCurrencyChange: Sb.action('onCurrencyChange'),
  onDelete: Sb.action('onDelete'),
  onEditName: Sb.action('onEditName'),
  onMobileOnlyModeChange: Sb.action('onMobileOnlyModeChange'),
  onSetDefault: Sb.action('setDefault'),
  onSetupInflation: Sb.action('onSetupInflation'),
  refresh: () => {},
  saveCurrencyWaiting: false,
  showExternalPartners: true,
  thisDeviceIsLockedOut: false,
  user: 'testuser',
}

const defaultSettingsProps = {
  ...sharedSettingsProps,
  currency: testCurrencies.get(1),
  isDefault: true,
  name: 'awesome account',
}

const secondarySettingsProps = {
  ...sharedSettingsProps,
  currency: testCurrencies.get(0),
  isDefault: false,
  mobileOnlyMode: true,
  name: 'some other account',
}

const provider = Sb.createPropProviderWithCommon({
  WalletSettingTrustline: () => ({
    assets: [
      {code: 'USD', issuerVerifiedDomain: 'stronghold.com'},
      {code: 'USD', issuerVerifiedDomain: 'example.com'},
    ],
    onSetupTrustline: Sb.action('onSetupTrustline'),
    refresh: Sb.action('refresh'),
  }),
})

const load = () => {
  Sb.storiesOf('Wallets/Wallet/Settings', module)
    .addDecorator(provider)
    .add('Default', () => <Settings {...defaultSettingsProps} />)
    .add('Default with inflation dest', () => (
      <Settings {...defaultSettingsProps} inflationDestination="Stellar Development Foundation" />
    ))
    .add("Not funded account (can't make tx)", () => (
      <Settings {...defaultSettingsProps} canSubmitTx={false} />
    ))
    .add('Secondary', () => <Settings {...secondarySettingsProps} />)
    .add('MobileOnlyEditable', () => <Settings {...secondarySettingsProps} mobileOnlyEditable={true} />)
    .add('Device is locked out', () => <Settings {...secondarySettingsProps} thisDeviceIsLockedOut={true} />)
  popups()
}

export default load
