import * as Container from '../../../util/container'
import * as Constants from '../../../constants/wallets'
import type * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import {SendButton as _SendButton} from '.'

type OwnProps = {
  small?: boolean
}

export const SendButton = (ownProps: OwnProps) => {
  const _account = Container.useSelector(state => Constants.getSelectedAccountData(state))
  const thisDeviceIsLockedOut = _account.deviceReadOnly

  const dispatch = Container.useDispatch()
  const _onGoToSendReceive = (from: Types.AccountID, recipientType: Types.CounterpartyType) => {
    dispatch(WalletsGen.createOpenSendRequestForm({from, recipientType}))
  }
  const props = {
    disabled: !_account.name || thisDeviceIsLockedOut,
    onSendToAnotherAccount: () => _onGoToSendReceive(_account.accountID, 'otherAccount'),
    onSendToKeybaseUser: () => _onGoToSendReceive(_account.accountID, 'keybaseUser'),
    onSendToStellarAddress: () => _onGoToSendReceive(_account.accountID, 'stellarPublicKey'),
    small: ownProps.small,
    thisDeviceIsLockedOut: thisDeviceIsLockedOut,
  }
  return <_SendButton {...props} />
}
