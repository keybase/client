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

export const props3 = {
  ...common,
  bottomLabel: '1 XLM = $0.2303',
  displayUnit: 'XLM',
  inputPlaceholder: '0.0000000',
}

const load = () => {
  storiesOf('Wallets/SendForm/Asset input', module)
    .addDecorator(story => <Box style={{maxWidth: 500, padding: 20}}>{story()}</Box>)
    .add('XLM worth USD', () => <AssetInput {...props1} />)
    .add('XLM', () => <AssetInput {...props3} />)
    .add('Asset', () => <AssetInput {...props2} />)
}

export default load
