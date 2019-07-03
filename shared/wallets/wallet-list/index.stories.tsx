import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {WalletList} from '.'
import walletRow from './wallet-row/index.stories'
import {stringToAccountID} from '../../constants/types/wallets'
import {isMobile} from '../../styles'

const onSelect = Sb.action('onSelect')

const mockWallets = {
  G43289XXXXX34OPL: {
    contents: '280.0871234 XLM + more',
    isSelected: true,
    keybaseUser: 'cecileb',
    name: "cecileb's account",
    onSelect,
  },
  G43289XXXXX34OPM: {
    contents: '56.9618203 XLM',
    isSelected: false,
    keybaseUser: '',
    name: 'Second account',
    onSelect,
  },
  G43289XXXXX34OPMG43289XXXXX34OPM: {
    contents: '56.9618203 XLM',
    isSelected: false,
    keybaseUser: '',
    name: 'G43289XXXXX34OPMG43289XXXXX34OPM',
    onSelect,
  },
}

const WalletRowProvider = mockWallets => ({
  WalletRow: ({accountID}) => {
    const mockWallet = mockWallets[accountID]
    return (
      mockWallet || {
        contents: '',
        isSelected: false,
        keybaseUser: '',
        name: '',
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
    .add('Wallet List without airdrop', () => (
      <WalletList
        loading={false}
        accountIDs={accountIDs}
        airdropIsLive={false}
        airdropSelected={false}
        inAirdrop={false}
        onAddNew={Sb.action('onAddNew')}
        onLinkExisting={Sb.action('onLinkExisting')}
        onWhatIsStellar={Sb.action('onWhatIsStellar')}
        onJoinAirdrop={Sb.action('onJoinAirdrop')}
        title="Wallets"
        style={{height: isMobile ? '100%' : 600, width: isMobile ? '100%' : 240}}
      />
    ))
    .add('Wallet List with airdrop, not in airdrop', () => (
      <WalletList
        loading={false}
        accountIDs={accountIDs}
        airdropIsLive={true}
        airdropSelected={false}
        inAirdrop={false}
        onAddNew={Sb.action('onAddNew')}
        onLinkExisting={Sb.action('onLinkExisting')}
        onWhatIsStellar={Sb.action('onWhatIsStellar')}
        onJoinAirdrop={Sb.action('onJoinAirdrop')}
        title="Wallets"
        style={{height: isMobile ? '100%' : 600, width: isMobile ? '100%' : 240}}
      />
    ))
    .add('Wallet List with airdrop, in airdrop', () => (
      <WalletList
        loading={false}
        accountIDs={accountIDs}
        airdropIsLive={true}
        airdropSelected={false}
        inAirdrop={true}
        onAddNew={Sb.action('onAddNew')}
        onLinkExisting={Sb.action('onLinkExisting')}
        onWhatIsStellar={Sb.action('onWhatIsStellar')}
        onJoinAirdrop={Sb.action('onJoinAirdrop')}
        title="Wallets"
        style={{height: isMobile ? '100%' : 600, width: isMobile ? '100%' : 240}}
      />
    ))
}

export default load
