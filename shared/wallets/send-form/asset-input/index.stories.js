// @flow
import * as React from 'react'
import {action, storiesOf} from '../../../stories/storybook'
import {Box} from '../../../common-adapters'
import AssetInput from '.'

const common = {
  onChangeAmount: action('onChangeAmount'),
  onChangeDisplayUnit: action('onChangeDisplayUnit'),
  onClickInfo: action('onClickInfo'),
  topLabel: '',
  value: '',
  refresh: action('onRefresh'),
}

const props1 = {
  ...common,
  bottomLabel: '$1 = 5.0992345 XLM',
  displayUnit: 'USD ($)',
  inputPlaceholder: '0.00',
  topLabel: 'XLM worth:',
}

const props2 = {
  ...common,
  bottomLabel: 'Issuer: Abc.def',
  displayUnit: 'BTC',
  inputPlaceholder: '0.0000000',
}

const props3 = {
  ...common,
  bottomLabel: '1 XLM = $0.2303',
  displayUnit: 'XLM',
  inputPlaceholder: '0.0000000',
}

// Exported for use in main send form story
export const props4 = {
  ...common,
  bottomLabel: '1 XLM = $0.2303',
  displayUnit: 'XLM',
  inputPlaceholder: '0.0000000',
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

const load = () => {
  storiesOf('Wallets/SendForm/Asset input', module)
    .addDecorator(story => <Box style={{maxWidth: 500, padding: 20}}>{story()}</Box>)
    .add('XLM worth USD', () => <AssetInput {...props1} />)
    .add('XLM', () => <AssetInput {...props3} />)
    .add('Asset', () => <AssetInput {...props2} />)
    .add('Prefilled XLM', () => <AssetInput {...props4} />)
    .add('USD over warning', () => <AssetInput {...props1} {...warning1} />)
    .add('XLM over warning', () => <AssetInput {...props2} {...warning2} />)
    .add('asset type warning', () => <AssetInput {...props3} {...warning3} />)
}

export default load
