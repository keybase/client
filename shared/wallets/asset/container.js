// @flow
import {Assets} from '.'
import {connect, type TypedState, type Dispatch} from '../../util/container'
import {getAssets} from '../../constants/wallets'

const mapStateToProps = (state: TypedState) => ({
  assets: getAssets(state),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  assets: stateProps.assets
    .map(asset => ({
      availableToSend: asset.balanceAvailableToSend,
      balance: asset.balanceTotal,
      code: asset.assetCode,
      equivAvailableToSend: '', // XXX: Need this from core.
      equivBalance: `${asset.worth} ${asset.worthCurrency}`,
      issuer: asset.issuer,
      issuerAddress: '', // XXX: Need this from core.
      name: asset.name,
      reserves: [], // XXX: Need this from core.
    }))
    .toArray(),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Assets)
