import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import * as Kb from '../../../common-adapters'
import {withStateHandlers} from '../../../util/container'
import AssetInputBasic from './asset-input-basic'

const provider = Sb.createPropProviderWithCommon({
  Available: () => ({
    amountErrMsg: '',
  }),
})

const common = {
  currencyLoading: false,
  onChangeAmount: Sb.action('onChangeAmount'),
  onChangeDisplayUnit: Sb.action('onChangeDisplayUnit'),
  topLabel: '',
  value: '',
}

const props1 = {
  ...common,
  bottomLabel: '$1 = 5.0992345 XLM',
  displayUnit: 'USD ($)',
  inputPlaceholder: '0.00',
  numDecimalsAllowed: 2,
  topLabel: 'XLM worth:',
}

const props2 = {
  ...common,
  bottomLabel: '1 XLM = $0.2303',
  displayUnit: 'XLM',
  inputPlaceholder: '0.0000000',
  numDecimalsAllowed: 7,
  value: '129',
}

const props3 = {
  ...common,
  bottomLabel: 'Issuer: Stronghold.com',
  displayUnit: 'BTC',
  inputPlaceholder: '0.0000000',
  numDecimalsAllowed: 7,
  value: '0.08',
}

// Exported for use in main send form story
export const props4 = {
  ...common,
  bottomLabel: '1 XLM = $0.2303',
  displayUnit: 'XLM',
  inputPlaceholder: '0.0000000',
  numDecimalsAllowed: 7,
  value: '3.4289000',
}

const warning1 = {
  warningAsset: '$13',
}

const warning2 = {
  warningAsset: '128.4567890 XLM',
}

const warning3 = {
  warningAsset: 'BTC/Stronghold.com',
  warningPayee: 'russel',
}

const asStatefulInput: any = withStateHandlers(
  (props: any) => ({
    value: props.value,
  }),
  {
    onChangeAmount: (_, props) => (value: string) => {
      props.onChangeAmount(value)
      return {value}
    },
  }
)

const StatefulAssetInputBasic = asStatefulInput(AssetInputBasic)
/*
const StatefulAssetInputRecipientAdvanced = asStatefulInput(AssetInputRecipientAdvanced)

export const propsRecipientAdvanced = {
  asset: Constants.makeAssetDescription({
    code: 'USD',
    issuerVerifiedDomain: 'Stronghold.com',
  }),
  currencyLoading: false,
  numDecimalsAllowed: 2,
  onChangeAmount: Sb.action('onChangeAmount'),
  recipientType: 'keybaseUser',
  to: 'songgao',
  value: '',
} as const

export const propsSenderAdvancedNotCalculated = {
  amountLoading: false,
  asset: Constants.makeAssetDescription({
    code: 'USD',
    issuerVerifiedDomain: 'Stronghold.com',
  }),
  numDecimals: 2,
} as const

const propsSenderAdvancedLoading = {
  amountLoading: true,
  asset: Constants.makeAssetDescription({
    code: 'USD',
    issuerVerifiedDomain: 'Stronghold.com',
  }),
  numDecimals: 2,
} as const

export const propsSenderAdvancedCalculated = {
  amountLoading: false,
  approximate: 83.47,
  atMost: 90.53,
  numDecimals: 2,
  recipientAsset: Constants.makeAssetDescription({
    code: 'USD',
    issuerVerifiedDomain: 'Stronghold.com',
  }),
  senderAsset: Constants.makeAssetDescription({
    code: 'EUR',
    issuerVerifiedDomain: 'Stronghold.com',
  }),
  xlmToRecipientAsset: 0.8347,
} as const
   */

const load = () => {
  Sb.storiesOf('Wallets/SendForm/Asset input basic', module)
    .addDecorator(provider)
    .addDecorator(story => <Kb.Box style={{maxWidth: 500, padding: 20}}>{story()}</Kb.Box>)
    .add('XLM worth USD', () => <AssetInputBasic {...props1} />)
    .add('XLM', () => <AssetInputBasic {...props2} />)
    .add('Asset', () => <AssetInputBasic {...props3} />)
    .add('Prefilled XLM', () => <AssetInputBasic {...props4} />)
    .add('USD over warning', () => <AssetInputBasic {...props1} {...warning1} />)
    .add('XLM over warning', () => <AssetInputBasic {...props2} {...warning2} />)
    .add('asset type warning', () => <AssetInputBasic {...props3} {...warning3} />)
    .add('Input validation (XLM)', () => <StatefulAssetInputBasic {...props2} />)
    .add('Input validation (Currency)', () => <StatefulAssetInputBasic {...props1} />)
  /*
  Sb.storiesOf('Wallets/SendForm/Asset input advanced', module)
    .addDecorator(provider)
    .addDecorator(story => <Kb.Box style={{maxWidth: 500, padding: 20}}>{story()}</Kb.Box>)
    .addDecorator(Sb.scrollViewDecorator)
    .add('to', () => (
      <Kb.Box2 direction="vertical" gap="small">
        <StatefulAssetInputRecipientAdvanced {...propsRecipientAdvanced} />
        <StatefulAssetInputRecipientAdvanced {...propsRecipientAdvanced} asset={undefined} />
      </Kb.Box2>
    ))
    .add('from', () => (
      <Kb.Box2 direction="vertical" gap="small">
        <AssetInputSenderAdvanced {...propsSenderAdvancedNotCalculated} />
        <AssetInputSenderAdvanced {...propsSenderAdvancedLoading} />
        <AssetInputSenderAdvanced {...propsSenderAdvancedCalculated} />
        <AssetInputSenderAdvanced {...propsSenderAdvancedCalculated} error={true} />
      </Kb.Box2>
    ))
     */
}

export default load
