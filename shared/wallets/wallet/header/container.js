// @flow
import {connect, isMobile} from '../../../util/container'
import {memoize} from '../../../util/memoize'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import Header from '.'

const otherUnreadPayments = memoize((map, accID) => !!map.delete(accID).some(Boolean))

type OwnProps = {navigateAppend: (...Array<any>) => any, onBack: () => void}

const mapStateToProps = state => {
  const accountID = Constants.getSelectedAccount(state)
  const selectedAccount = Constants.getAccount(state, accountID)
  return {
    accountID: selectedAccount.accountID,
    isDefaultWallet: selectedAccount.isDefault,
    keybaseUser: state.config.username,
    sendDisabled: !isMobile && !!state.wallets.mobileOnlyMap.getIn([selectedAccount.accountID]),
    unreadPayments: otherUnreadPayments(state.wallets.unreadPaymentsMap, selectedAccount.accountID),
    walletName: selectedAccount.name,
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onGoToSendReceive: (from: Types.AccountID, recipientType: Types.CounterpartyType, isRequest: boolean) => {
    dispatch(
      WalletsGen.createOpenSendRequestForm({
        from,
        isRequest,
        recipientType,
      })
    )
  },
  _onReceive: (accountID: Types.AccountID) =>
    dispatch(
      ownProps.navigateAppend([
        {
          props: {accountID},
          selected: 'receive',
        },
      ])
    ),
  _onSettings: (accountID: Types.AccountID) =>
    dispatch(
      ownProps.navigateAppend([
        {
          props: {accountID},
          selected: 'settings',
        },
      ])
    ),
  _onShowSecretKey: (accountID: Types.AccountID, walletName: ?string) =>
    dispatch(
      ownProps.navigateAppend([
        {
          props: {accountID, walletName},
          selected: 'exportSecretKey',
        },
      ])
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  onBack: isMobile ? ownProps.onBack : null,
  onReceive: () => dispatchProps._onReceive(stateProps.accountID),
  onRequest: () => dispatchProps._onGoToSendReceive(stateProps.accountID, 'keybaseUser', true),
  onSendToAnotherAccount: () => dispatchProps._onGoToSendReceive(stateProps.accountID, 'otherAccount', false),
  onSendToKeybaseUser: () => dispatchProps._onGoToSendReceive(stateProps.accountID, 'keybaseUser', false),
  onSendToStellarAddress: () =>
    dispatchProps._onGoToSendReceive(stateProps.accountID, 'stellarPublicKey', false),
  onSettings: () => dispatchProps._onSettings(stateProps.accountID),
  onShowSecretKey: stateProps.sendDisabled
    ? null
    : () => dispatchProps._onShowSecretKey(stateProps.accountID, stateProps.walletName),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Header)
