// @flow
import {compose, namedConnect, safeSubmitPerMount, type RouteProps} from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import RemoveAccountPopup from '.'

type OwnProps = RouteProps<{accountID: Types.AccountID}, {}>

const mapStateToProps = (state, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  const account = Constants.getAccount(state, accountID)

  return {
    accountID,
    balance: account.balanceDescription,
    name: account.name,
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
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
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  balance: stateProps.balance,
  name: stateProps.name,
  onClose: () => dispatchProps._onClose(),
  onDelete: () => dispatchProps._onDelete(stateProps.accountID),
})

export default compose(
  namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'RemoveAccountPopup'),
  safeSubmitPerMount(['onDelete'])
)(RemoveAccountPopup)
