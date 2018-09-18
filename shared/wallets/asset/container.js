// @flow
import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import {connect, type TypedState} from '../../util/container'
import Asset from '.'

type OwnProps = {
  accountID: Types.AccountID,
  index: number,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  _asset: Constants.getAssets(state, ownProps.accountID).get(ownProps.index, Constants.makeAssets()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const asset = stateProps._asset
  return {
    availableToSend: asset.balanceAvailableToSend,
    balance: asset.balanceTotal,
    code: asset.assetCode,
    equivAvailableToSend: `${asset.availableToSendWorth} ${asset.worthCurrency}`,
    equivBalance: `${asset.worth} ${asset.worthCurrency}`,
    issuerAccountID: asset.issuerAccountID,
    issuerName: asset.issuerName || 'Unknown',
    name: asset.name,
    reserves: asset.reserves.toArray(),
  }
}

export default connect(mapStateToProps, () => ({}), mergeProps)(Asset)
