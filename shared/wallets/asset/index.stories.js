// @flow
import * as React from 'react'
import * as Constants from '../../constants/wallets'
import {Box, Divider} from '../../common-adapters'
import * as Sb from '../../stories/storybook'
import Asset from '.'

const openStellarURL = Sb.action('openStellarURL')

const native = {
  availableToSend: '122.0000000',
  balance: '123.5000000',
  code: 'XLM',
  equivAvailableToSend: '$53.41 USD',
  equivBalance: '$54.14 USD',
  issuerAccountID: '',
  issuerName: 'Stellar network',
  name: 'Lumens',
  openStellarURL,
  reserves: [
    Constants.makeReserve({amount: '1', description: 'account'}),
    Constants.makeReserve({amount: '0.5', description: 'KEYZ/keybase.io trust line'}),
  ],
}

const keyz = {
  availableToSend: '',
  balance: '12.0000000',
  code: 'KEYZ',
  equivAvailableToSend: '',
  equivBalance: '',
  issuerAccountID: 'GAXLYHWCWQK273FMHITINCMVTHHRBBNG7A5XWGDYRDDWCR3RSCGLIDWQ',
  issuerName: 'keybase.io',
  name: 'KEYZ',
  openStellarURL,
  reserves: [],
}

const btc = {
  availableToSend: '',
  balance: '0.1324354',
  code: 'BTC',
  equivAvailableToSend: '',
  equivBalance: '',
  issuerAccountID: 'GAT7ABIQKJ6BBBH7ASKMAV5FMND3YDQLKPFJUCHR7Y5PNRTA7VLA55IW',
  issuerName: 'FarcicalBTCAnchor.eg',
  name: 'BTC',
  openStellarURL,
  reserves: [],
}

const btexcadv = {
  availableToSend: '',
  balance: '0.0284664',
  code: 'BTEXCADV',
  equivAvailableToSend: '',
  equivBalance: '',
  issuerAccountID: 'GCN5SJA4CFUC7AVZGEPVVSXDEIBZYA77MAAEIA5ZXZKL5CVTJH6TUL6A',
  issuerName: 'Unknown',
  name: 'BTEXCADV',
  openStellarURL,
  reserves: [],
}

const load = () => {
  Sb.storiesOf('Wallets/Assets', module)
    .addDecorator(story => <Box style={{maxWidth: 520}}>{story()}</Box>)
    .add('Native currency', () => <Asset {...native} />)
    .add('Non-native currency', () => <Asset {...keyz} />)
    .add('Native expanded', () => <Asset {...native} expanded={true} />)
    .add('Non-native expanded', () => <Asset {...keyz} expanded={true} />)
    .add('List', () => (
      <React.Fragment>
        <Asset {...native} />
        <Divider />
        <Asset {...keyz} />
        <Divider />
        <Asset {...btc} />
        <Divider />
        <Asset {...btexcadv} />
      </React.Fragment>
    ))
}

export default load
