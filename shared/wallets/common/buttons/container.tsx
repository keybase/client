import * as Container from '../../../util/container'
import * as Constants from '../../../constants/wallets'
import type * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import {SendButton as _SendButton} from '.'

type SendButtonOwnProps = {
  small?: boolean
}

export const SendButton = Container.connect(
  state => {
    const _account = Constants.getSelectedAccountData(state)
    return {
      _account,
      thisDeviceIsLockedOut: _account.deviceReadOnly,
    }
  },
  dispatch => ({
    _onGoToSendReceive: (from: Types.AccountID, recipientType: Types.CounterpartyType) =>
      dispatch(WalletsGen.createOpenSendRequestForm({from, recipientType})),
  }),
  (stateProps, dispatchProps, ownProps: SendButtonOwnProps) => ({
    disabled: !stateProps._account.name || stateProps.thisDeviceIsLockedOut,
    onSendToAnotherAccount: () =>
      dispatchProps._onGoToSendReceive(stateProps._account.accountID, 'otherAccount'),
    onSendToKeybaseUser: () => dispatchProps._onGoToSendReceive(stateProps._account.accountID, 'keybaseUser'),
    onSendToStellarAddress: () =>
      dispatchProps._onGoToSendReceive(stateProps._account.accountID, 'stellarPublicKey'),
    small: ownProps.small,
    thisDeviceIsLockedOut: stateProps.thisDeviceIsLockedOut,
  })
)(_SendButton)
