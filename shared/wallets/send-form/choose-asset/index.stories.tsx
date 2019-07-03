import * as React from 'react'
import {action, storiesOf} from '../../../stories/storybook'
import ChooseAsset from '.'

const props = {
  displayChoices: [
    {currencyCode: 'Lumens', selected: false, symbol: 'XLM', type: 'display choice' as const},
    {currencyCode: 'USD', selected: false, symbol: '$', type: 'display choice' as const},
    {currencyCode: 'EUR', selected: true, symbol: '€', type: 'display choice' as const},
    {currencyCode: 'GBP', selected: false, symbol: '£', type: 'display choice' as const},
    {currencyCode: 'CAD', selected: false, symbol: '$', type: 'display choice' as const},
    {currencyCode: 'CRC', selected: false, symbol: '₡', type: 'display choice' as const},
    {currencyCode: 'JPY', selected: false, symbol: '¥', type: 'display choice' as const},
    {currencyCode: 'FJD', selected: false, symbol: '$', type: 'display choice' as const},
    {currencyCode: 'HNL', selected: false, symbol: 'L', type: 'display choice' as const},
    {currencyCode: 'KRW', selected: false, symbol: '₩', type: 'display choice' as const},
  ],
  isRequest: false,
  onBack: action('onBack'),
  onChoose: action('onChoose'),
  onRefresh: action('onRefresh'),
  otherChoices: [
    {
      currencyCode: 'BTC',
      disabledExplanation: '',
      issuer: 'Stronghold.co',
      selected: false,
      type: 'other choice' as const,
    },
    {
      currencyCode: 'KEYZ',
      disabledExplanation: '',
      issuer: 'Unknown',
      selected: false,
      type: 'other choice' as const,
    },
    {
      currencyCode: 'HUGZ',
      disabledExplanation: `max doesn't accept HUGZ.`,
      issuer: 'Jed',
      selected: false,
      type: 'other choice' as const,
    },
  ],
  selected: 'XLM',
}

const load = () => {
  storiesOf('Wallets/SendForm', module).add('Choose asset', () => <ChooseAsset {...props} />)
}

export default load
