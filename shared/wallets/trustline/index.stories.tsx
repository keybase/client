import * as I from 'immutable'
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/wallets'
import Asset from './asset'
import Trustline from '.'

const commonAssetProps = {
  onAccept: Sb.action('onAccept'),
  onRemove: Sb.action('onRemove'),
  onViewDetails: Sb.action('onViewDetails'),
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
  'issuer1-KEYZ': Constants.makeTrustlineAsset({
    assetCode: 'KEYZ',
    issuerAccountID: '1BQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I41',
    issuerVerifiedDomain: 'issuer1.com',
    trustedLimit: 1,
  }),
  'issuer1-USD': Constants.makeTrustlineAsset({
    assetCode: 'USD',
    issuerAccountID: '1BQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I41',
    issuerVerifiedDomain: 'issuer1.com',
    trustedLimit: 0,
  }),
  'issuer2-KEYZ': Constants.makeTrustlineAsset({
    assetCode: 'KEYZ',
    issuerAccountID: '2BQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I41',
    issuerVerifiedDomain: 'issuer2.com',
    trustedLimit: 0,
  }),
  'issuer2-PINGPONG': Constants.makeTrustlineAsset({
    assetCode: 'PINGPONG',
    issuerAccountID: '2BQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I41',
    issuerVerifiedDomain: 'issuer2.com',
    trustedLimit: 0,
  }),
  'issuer2-USD': Constants.makeTrustlineAsset({
    assetCode: 'USD',
    issuerAccountID: '2BQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I41',
    issuerVerifiedDomain: '',
    trustedLimit: 0,
  }),
}

const commonTrustlineProps = {
  acceptedAssets: I.List(['issuer1-KEYZ']),
  onDone: Sb.action('onDone'),
  onSearchChange: Sb.action('onSearchChange'),
  popularAssets: I.List(['issuer1-USD', 'issuer2-USD', 'issuer2-KEYZ', 'issuer2-PINGPONG']),
  totalAssetsCount: Object.keys(assets).length,
}

const provider = Sb.createPropProviderWithCommon({
  Asset: ({firstItem, trustlineAssetID}) => {
    const asset = assets[trustlineAssetID]
    return asset
      ? {
          ...commonAssetProps,
          code: asset.assetCode,
          expanded: asset.assetCode === 'KEYZ',
          firstItem,
          issuerAccountID: asset.issuerAccountID,
          issuerVerifiedDomain: asset.issuerVerifiedDomain,
          onCollapse: Sb.action('onCollapse'),
          onExpand: Sb.action('onExpand'),
          trusted: !!asset.trustedLimit,
        }
      : Constants.emptyTrustlineAsset
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
      <Trustline {...commonTrustlineProps} searchingAssets={I.List(['issuer1-USD', 'issuer2-USD'])} />
    ))
    .add('Trustline - error', () => (
      <Trustline
        {...commonTrustlineProps}
        errorMessage="Stellar holds 0.5 XLM per trustline, and your Lumens balance is 0.32341567 XLM."
      />
    ))
}

export default load
