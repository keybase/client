import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import Settings from '.'
import popups from './popups/index.stories'
import * as Types from '../../../constants/types/wallets'
import * as Constants from '../../../constants/wallets'

const testCurrencies = [
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
].map(c => Constants.currencyResultToCurrency(c))

const externalPartner = {
  adminOnly: false,
  canPurchase: false,
  description: 'Example description.',
  extra: 'Example extra.',
  iconFilename: 'iconfont-identity-stellar',
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
  mobileOnlyEditable: false,
  mobileOnlyMode: false,
  mobileOnlyWaiting: false,
  onBack: Sb.action('onBack'),
  onCurrencyChange: Sb.action('onCurrencyChange'),
  onDelete: Sb.action('onDelete'),
  onEditName: Sb.action('onEditName'),
  onLoadSecretKey: Sb.action('onLoadSecretKey'),
  onMobileOnlyModeChange: Sb.action('onMobileOnlyModeChange'),
  onSecretKeySeen: Sb.action('onSecretKeySeen'),
  onSetDefault: Sb.action('setDefault'),
  refresh: () => {},
  saveCurrencyWaiting: false,
  secretKey: 'NOTASECRETKEY',
  showExternalPartners: true,
  thisDeviceIsLockedOut: false,
  user: 'testuser',
}

const defaultSettingsProps = {
  ...sharedSettingsProps,
  currency: testCurrencies[1] as Types.Currency,
  isDefault: true,
  name: 'awesome account',
}

const secondarySettingsProps = {
  ...sharedSettingsProps,
  currency: testCurrencies[0] as Types.Currency,
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
    .add("Not funded account (can't make tx)", () => (
      <Settings {...defaultSettingsProps} canSubmitTx={false} />
    ))
    .add('Default with loading secret key', () => <Settings {...defaultSettingsProps} secretKey="" />)
    .add('Secondary', () => <Settings {...secondarySettingsProps} />)
    .add('MobileOnlyEditable', () => <Settings {...secondarySettingsProps} mobileOnlyEditable={true} />)
    .add('Device is locked out', () => <Settings {...secondarySettingsProps} thisDeviceIsLockedOut={true} />)
  popups()
}

export default load
