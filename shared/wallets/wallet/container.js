// @flow
import {connect, type TypedState} from '../../util/container'
import * as Constants from '../../constants/wallets'
import Wallet from '.'

const mapStateToProps = (state: TypedState) => ({
  accountID: Constants.getSelectedAccount(state),
  assets: Constants.getAssets(state),
})

const mergeProps = stateProps => {
  const sections = []
  // layout is
  // 1. header (TODO: not included in list yet)
  // 2. assets header and list of assets
  // 3. assets
  // Formatted in a SectionList
  sections.push({title: 'Your assets', data: stateProps.assets.map((a, index) => index).toArray()})
  return {accountID: stateProps.accountID, sections}
}

export default connect(mapStateToProps, null, mergeProps)(Wallet)
