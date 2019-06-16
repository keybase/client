import * as Container from '../../util/container'
import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import Asset from './asset'

type OwnProps = {
  firstItem: boolean
  trustlineAssetID: Types.TrustlineAssetID
}

const mapStateToProps = (state, props: OwnProps) => ({
  expandedAssets: state.wallets.trustline.expandedAssets,
  trustlineAsset: state.wallets.trustline.get(props.trustlineAssetID, Constants.emptyTrustlineAsset),
})

const mapDispatchToProps = (dispatch, props: OwnProps) => ({
  onCollapse: () =>
    dispatch(
      WalletsGen.createSetTrustlineExpanded({
        expanded: false,
        trustlineAssetID: props.trustlineAssetID,
      })
    ),
  onDone: RouteTreeGen.createNavigateUp(),
  onExpand: () =>
    dispatch(
      WalletsGen.createSetTrustlineExpanded({
        expanded: true,
        trustlineAssetID: props.trustlineAssetID,
      })
    ),
})

const mergeProps = (s, d, o: OwnProps) => ({
  code: s.trustlineAsset.code,
  expanded: s.expandedAssets.includes(o.trustlineAssetID),
  firstItem: o.firstItem,
  issuerAccountID: s.trustline.issuerAccountID,
  issuerVerifiedDomain: s.trustline.issuerVerifiedDomain,
  onAccept: () => {}, // TODO PICNIC-53
  onCollapse: d.onCollapse,
  onExpand: d.onExpand,
  onRemove: () => {}, // TODO PICNIC-53
  onViewDetails: () => {}, // TODO PICNIC-53
  trusted: !!s.trustline.trustedLimit,
})

export default Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Asset')(Asset)
