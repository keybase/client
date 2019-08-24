import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import Asset from './asset'
import Trustline from '.'

const commonAssetProps = {
  depositButtonText: 'Deposit',
  infoUrlText: 'View details',
  onAccept: Sb.action('onAccept'),
  onDeposit: Sb.action('onDeposit'),
  onOpenInfoUrl: Sb.action('onOpenInfoUrl'),
  onRemove: Sb.action('onRemove'),
  onWithdraw: Sb.action('onWithdraw'),
  waitingKeyAdd: false,
  waitingKeyDelete: false,
  waitingRefresh: false,
  withdrawButtonText: 'Withdraw',
}

const AssetWrapper = props => {
  const [expanded, setExpanded] = React.useState(false)
  return (
    <Asset
      expanded={expanded}
      onCollapse={() => setExpanded(false)}
      onExpand={() => setExpanded(true)}
      {...commonAssetProps}
      {...props}
    />
  )
}

const assets = {
  'issuer1-KEYZ': Constants.makeAssetDescription({
    code: 'KEYZ',
    issuerAccountID: '1BQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I41',
    issuerVerifiedDomain: 'issuer1.com',
  }),
  'issuer1-USD': Constants.makeAssetDescription({
    code: 'USD',
    issuerAccountID: '1BQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I41',
    issuerVerifiedDomain: 'issuer1.com',
  }),
  'issuer2-KEYZ': Constants.makeAssetDescription({
    code: 'KEYZ',
    issuerAccountID: '2BQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I41',
    issuerVerifiedDomain: 'issuer2.com',
  }),
  'issuer2-PINGPONG': Constants.makeAssetDescription({
    code: 'PINGPONG',
    issuerAccountID: '2BQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I41',
    issuerVerifiedDomain: 'issuer2.com',
  }),
  'issuer2-USD': Constants.makeAssetDescription({
    code: 'USD',
    issuerAccountID: '2BQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I41',
    issuerVerifiedDomain: '',
  }),
}

const commonTrustlineProps = {
  acceptedAssets: ['issuer1-KEYZ'],
  accountID: Types.noAccountID,
  balanceAvailableToSend: '2',
  canAddTrustline: true,
  clearTrustlineModal: Sb.action('clearTrustlineModal'),
  error: '',
  loaded: true,
  onDone: Sb.action('onDone'),
  onSearchChange: Sb.action('onSearchChange'),
  popularAssets: ['issuer1-USD', 'issuer2-USD', 'issuer2-KEYZ', 'issuer2-PINGPONG'],
  refresh: Sb.action('refresh'),
  totalAssetsCount: Object.keys(assets).length,
  waitingSearch: false,
}

const provider = Sb.createPropProviderWithCommon({
  Asset: ({firstItem, assetID}) => {
    const asset = assets[assetID] || Constants.emptyAssetDescription
    return {
      ...commonAssetProps,
      code: asset.code,
      expanded: asset.code === 'KEYZ',
      firstItem,
      issuerAccountID: asset.issuerAccountID,
      issuerVerifiedDomain: asset.issuerVerifiedDomain,
      onCollapse: Sb.action('onCollapse'),
      onExpand: Sb.action('onExpand'),
      trusted: assetID === 'issuer1-KEYZ',
    }
  },
})

const load = () => {
  Sb.storiesOf('Wallets/Trustline', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Asset', () => (
      <Kb.Box2 direction="vertical">
        <AssetWrapper
          firstItem={true}
          code="USD"
          issuerVerifiedDomain="Stronghold.com"
          issuerAccountID="GBQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I41"
          trusted={true}
        />
        <AssetWrapper
          firstItem={false}
          code="USD"
          issuerVerifiedDomain=""
          issuerAccountID="GBQTE2V7Y356T"
          trusted={false}
        />
        <AssetWrapper
          firstItem={false}
          code="USD"
          issuerVerifiedDomain="chase.com"
          issuerAccountID="GBQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I43"
          trusted={false}
        />
        <AssetWrapper
          firstItem={false}
          code="USD"
          issuerVerifiedDomain="chase.com"
          issuerAccountID="GBQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I43"
          trusted={false}
        />
      </Kb.Box2>
    ))
  Sb.storiesOf('Wallets/Trustline', module)
    .addDecorator(provider)
    .add('Trustline', () => <Trustline {...commonTrustlineProps} />)
    .add('Trustline - search', () => (
      <Trustline {...commonTrustlineProps} searchingAssets={['issuer1-USD', 'issuer2-USD']} />
    ))
    .add('Trustline - error', () => <Trustline {...commonTrustlineProps} balanceAvailableToSend="0.2" />)
    .add('Trustline - unable to add', () => (
      <Trustline {...commonTrustlineProps} balanceAvailableToSend="0.2" canAddTrustline={false} />
    ))
    .add('Trustline - loading', () => <Trustline {...commonTrustlineProps} loaded={false} />)
}

export default load
