import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as ConfigConstants from '../../constants/config'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderTitle as _HeaderTitle, HeaderRightActions as _HeaderRightActions} from '.'

export const HeaderTitle = () => {
  const _account = Container.useSelector(state => Constants.getSelectedAccountData(state))
  const noDisclaimer = Container.useSelector(state => !state.wallets.acceptedDisclaimer)
  const username = ConfigConstants.useConfigState(s => s.username)
  const props = {
    accountID: _account.accountID,
    accountName: _account.name,
    isDefault: _account.isDefault,
    loading: _account.accountID === Types.noAccountID,
    noDisclaimer: noDisclaimer,
    username: username,
  }
  return <_HeaderTitle {...props} />
}

export const HeaderRightActions = () => {
  const _accountID = Container.useSelector(state => Constants.getSelectedAccount(state))
  const noDisclaimer = Container.useSelector(state => !state.wallets.acceptedDisclaimer)
  const dispatch = Container.useDispatch()
  const _onReceive = (accountID: Types.AccountID) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {accountID},
            selected: 'receive',
          },
        ],
      })
    )
  const onSettings = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['settings']}))
  }
  const props = {
    loading: _accountID === Types.noAccountID,
    noDisclaimer: noDisclaimer,
    onReceive: () => _onReceive(_accountID),
    onSettings: onSettings,
  }
  return <_HeaderRightActions {...props} />
}
