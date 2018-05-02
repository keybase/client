// @flow
import * as React from 'react'
import * as Constants from '../../constants/wallets'
import {Box} from '../../common-adapters'
import {action, storiesOf} from '../../stories/storybook'
import Asset from '.'

const common = {
  expanded: false,
  toggleExpanded: action('toggleExpanded'),
}

const native = {
  ...common,
  availableToSend: '122.0000000 XLM',
  balance: '123.5000000 XLM',
  equivAvailableToSend: '$53.41 USD',
  equivBalance: '$54.14 USD',
  issuer: 'Stellar network',
  issuerAddress: '',
  name: 'Lumens',
  reserves: [
    Constants.makeReserve({amount: '1.0', description: 'account'}),
    Constants.makeReserve({amount: '0.5', description: 'KEYZ/Unknown trust line'}),
  ],
}

const keyz = {
  ...common,
  availableToSend: '12.0000000 KEYZ',
  balance: '12.0000000 KEYZ',
  equivAvailableToSend: '',
  equivBalance: '',
  issuer: 'keybase.io',
  issuerAddress: 'G......',
  name: 'KEYZ',
  reserves: [],
}

const load = () => {
  storiesOf('Stellar/Assets', module)
    .addDecorator(story => <Box style={{width: 520}}>{story()}</Box>)
    .add('Native currency', () => <Asset {...native} />)
    .add('Non-native currency', () => <Asset {...keyz} />)
    .add('Native expanded', () => <Asset {...native} expanded={true} />)
}

export default load
