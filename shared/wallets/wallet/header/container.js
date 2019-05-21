// @flow
import {connect, isMobile} from '../../../util/container'
import {memoize} from '../../../util/memoize'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import Header from '.'

const otherUnreadPayments = memoize((map, accID) => !!map.delete(accID).some(Boolean))

type OwnProps = {onBack: () => void}

const mapStateToProps = state => {
  const accountID = Constants.getSelectedAccount(state)
  const selectedAccount = Constants.getAccount(state, accountID)
  return {
    accountID: selectedAccount.accountID,
    isDefaultWallet: selectedAccount.isDefault,
    keybaseUser: state.config.username,
    thisDeviceIsLockedOut: selectedAccount.deviceReadOnly,
    unreadPayments: otherUnreadPayments(state.wallets.unreadPaymentsMap, selectedAccount.accountID),
    walletName: selectedAccount.name,
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onReceive: (accountID: Types.AccountID) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {accountID},
            selected: 'receive',
          },
        ],
      })
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  onBack: isMobile ? ownProps.onBack : null,
  onReceive: () => dispatchProps._onReceive(stateProps.accountID),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Header)
