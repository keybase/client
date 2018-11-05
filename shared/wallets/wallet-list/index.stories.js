// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {WalletList} from '.'
import walletRow from './wallet-row/index.stories'
import {stringToAccountID} from '../../constants/types/wallets'
import {isMobile} from '../../styles'

const onSelect = Sb.action('onSelect')

const mockWallets = {
  G43289XXXXX34OPL: {
    keybaseUser: 'cecileb',
    name: "cecileb's account",
    contents: '280.0871234 XLM + more',
    isSelected: true,
    onSelect,
  },
  G43289XXXXX34OPM: {
    keybaseUser: '',
    name: 'Second account',
    contents: '56.9618203 XLM',
    isSelected: false,
    onSelect,
  },
  G43289XXXXX34OPMG43289XXXXX34OPM: {
    keybaseUser: '',
    name: 'G43289XXXXX34OPMG43289XXXXX34OPM',
    contents: '56.9618203 XLM',
    isSelected: false,
    onSelect,
  },
}

const WalletRowProvider = mockWallets => ({
  WalletRow: ({accountID}) => {
    const mockWallet = mockWallets[accountID]
    return (
      mockWallet || {
        keybaseUser: '',
        name: '',
        contents: '',
        isSelected: false,
        onSelect,
      }
    )
  },
})

const accountIDs = Object.keys(mockWallets).map(s => stringToAccountID(s))

const load = () => {
  walletRow()

  Sb.storiesOf('Wallets', module)
    .addDecorator(Sb.createPropProviderWithCommon(WalletRowProvider(mockWallets)))
    .add('Wallet List', () => (
      <WalletList
        refresh={Sb.action('refresh')}
        accountIDs={accountIDs}
        onAddNew={Sb.action('onAddNew')}
        onLinkExisting={Sb.action('onLinkExisting')}
        onWhatIsStellar={Sb.action('onWhatIsStellar')}
        title="Wallets"
        style={{height: '100%', width: isMobile ? '100%' : 240}}
      />
    ))
}

export default load
