// @flow
import * as React from 'react'
import * as Constants from '../../constants/wallets'
import {Box, Divider} from '../../common-adapters'
import {storiesOf} from '../../stories/storybook'
import Asset from '.'

const native = {
  availableToSend: '122.0000000',
  balance: '123.5000000',
  code: 'XLM',
  equivAvailableToSend: '$53.41 USD',
  equivBalance: '$54.14 USD',
  issuerName: 'Stellar network',
  issuerAccountID: '',
  name: 'Lumens',
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
  issuerName: 'keybase.io',
  issuerAccountID: 'GAXLYHWCWQK273FMHITINCMVTHHRBBNG7A5XWGDYRDDWCR3RSCGLIDWQ',
  name: 'KEYZ',
  reserves: [],
}

const btc = {
  availableToSend: '',
  balance: '0.1324354',
  code: 'BTC',
  equivAvailableToSend: '',
  equivBalance: '',
  issuerName: 'FarcicalBTCAnchor.eg',
  issuerAccountID: 'GAT7ABIQKJ6BBBH7ASKMAV5FMND3YDQLKPFJUCHR7Y5PNRTA7VLA55IW',
  name: 'BTC',
  reserves: [],
}

const btexcadv = {
  availableToSend: '',
  balance: '0.0284664',
  code: 'BTEXCADV',
  equivAvailableToSend: '',
  equivBalance: '',
  issuerName: 'Unknown',
  issuerAccountID: 'GCN5SJA4CFUC7AVZGEPVVSXDEIBZYA77MAAEIA5ZXZKL5CVTJH6TUL6A',
  name: 'BTEXCADV',
  reserves: [],
}

const load = () => {
  storiesOf('Wallets/Assets', module)
    .addDecorator(story => <Box style={{maxWidth: 520}}>{story()}</Box>)
    .add('Native currency', () => <Asset {...native} />)
    .add('Non-native currency', () => <Asset {...keyz} />)
    .add('Native expanded', () => <Asset {...native} />)
    .add('Non-native expanded', () => <Asset {...keyz} />)
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
