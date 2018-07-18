// @flow
import * as React from 'react'
import {action, storiesOf} from '../../../stories/storybook'
import ChooseAsset from '.'

const props = {
  displayChoices: [
    {currencyCode: 'Lumens', symbol: 'XLM', type: 'display choice'},
    {currencyCode: 'USD', symbol: '$', type: 'display choice'},
    {currencyCode: 'EUR', symbol: '€', type: 'display choice'},
    {currencyCode: 'GBP', symbol: '£', type: 'display choice'},
    {currencyCode: 'CAD', symbol: '$', type: 'display choice'},
    {currencyCode: 'CRC', symbol: '₡', type: 'display choice'},
    {currencyCode: 'JPY', symbol: '¥', type: 'display choice'},
    {currencyCode: 'FJD', symbol: '$', type: 'display choice'},
    {currencyCode: 'HNL', symbol: 'L', type: 'display choice'},
    {currencyCode: 'KRW', symbol: '₩', type: 'display choice'},
  ],
  onChoose: action('onChoose'),
  otherChoices: [
    {code: 'BTC', disabledExplanation: '', issuer: 'Stronghold.co', type: 'other choice'},
    {code: 'KEYZ', disabledExplanation: '', issuer: 'Unknown', type: 'other choice'},
    {code: 'HUGZ', disabledExplanation: `max doesn't accept HUGZ.`, issuer: 'Jed', type: 'other choice'},
  ],
}

const load = () => {
  storiesOf('Wallets/SendForm/Choose asset', module).add('Basic', () => <ChooseAsset {...props} />)
}

export default load
