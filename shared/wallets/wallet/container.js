// @flow
import {connect, type TypedState} from '../../util/container'
import * as Constants from '../../constants/wallets'
import {partition} from 'lodash-es'
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
  // 3. transactions header and transactions
  // Formatted in a SectionList
  sections.push({data: stateProps.assets.map((a, index) => index).toArray(), title: 'Your assets'})
  const payments = stateProps.payments.map(p => ({paymentID: p.id, status: p.statusSimplified})).toArray()

  console.warn('payments', payments)
  const [completed, pending] = partition(payments, {status: 'completed'})

  console.warn('completed, pending', completed, pending)

  sections.push({data: pending, title: 'Pending'})
  sections.push({data: completed, title: 'History'})
  console.warn('section', sections, completed, pending)
  return {
    accountID: stateProps.accountID,
    navigateAppend: dispatchProps.navigateAppend,
    sections,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Wallet)
