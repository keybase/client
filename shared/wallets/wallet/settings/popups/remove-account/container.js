// @flow
import {
  compose,
  connect,
  setDisplayName,
  safeSubmitPerMount,
} from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import RemoveAccountPopup from '.'

const mapStateToProps = (state, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  const account = Constants.getAccount(state, accountID)

  return {
    accountID,
    balance: account.balanceDescription,
    name: account.name || accountID,
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    _onClose: () => dispatch(ownProps.navigateUp()),
    _onDelete: (accountID: Types.AccountID) => {
      dispatch(
        ownProps.navigateAppend([
          {
            props: {accountID},
            selected: 'reallyRemoveAccount',
          },
        ])
      )
    },
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  balance: stateProps.balance,
  name: stateProps.name,
  onClose: () => dispatchProps._onClose(),
  onDelete: () => dispatchProps._onDelete(stateProps.accountID),
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('RemoveAccountPopup'),
  safeSubmitPerMount(['onDelete'])
)(RemoveAccountPopup)
