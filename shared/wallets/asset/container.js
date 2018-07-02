// @flow
import {Assets} from '.'
import {connect, type TypedState, type Dispatch} from '../../util/container'
import {getAssets} from '../../constants/wallets'

const mapStateToProps = (state: TypedState) => ({
  assets: getAssets(state),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const assets = stateProps.assets
    .map(asset => ({
      asset: {
        availableToSend: asset.balanceAvailableToSend,
        balance: asset.balanceTotal,
        code: asset.assetCode,
        equivAvailableToSend: '', // XXX: Need this from core.
        equivBalance: `${asset.worth} ${asset.worthCurrency}`,
        issuerAddress: asset.issuerAddress,
        issuerName: asset.issuerName || 'Unknown',
        name: asset.name,
        reserves: [], // XXX: Need this from core.
      },
      type: 'asset',
    }))
    .toArray()
  if (assets.length > 0) {
    assets.unshift({type: 'header'})
  }
  return {
    assets,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Assets)
