// @flow
import {connect, type TypedState} from '../../util/container'
import * as Constants from '../../constants/wallets'
import Wallet from '.'

const mapStateToProps = (state: TypedState) => ({
  accountID: Constants.getSelectedAccount(state),
  assets: Constants.getAssets(state),
  payments: Constants.getPayments(state),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateAppend}) => ({
  navigateAppend,
})

const mergeProps = (stateProps, dispatchProps) => {
  const sections = []
  // layout is
  // 1. header (TODO: not included in list yet)
  // 2. assets header and list of assets
  // 3. transactions header and transactions (TODO)
  // Formatted in a SectionList
  sections.push({data: stateProps.assets.map((a, index) => index).toArray(), title: 'Your assets'})
  sections.push({data: stateProps.payments.map(p => ({paymentID: p.id})).toArray(), title: 'History'})
  return {
    accountID: stateProps.accountID,
    navigateAppend: dispatchProps.navigateAppend,
    sections,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Wallet)
