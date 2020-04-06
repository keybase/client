import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderTitle as _HeaderTitle, HeaderRightActions as _HeaderRightActions} from '.'

export const HeaderTitle = Container.namedConnect(
  state => ({
    _account: Constants.getSelectedAccountData(state),
    noDisclaimer: !state.wallets.acceptedDisclaimer,
    username: state.config.username,
  }),
  () => ({}),
  s => ({
    accountID: s._account.accountID,
    accountName: s._account.name,
    isDefault: s._account.isDefault,
    loading: s._account.accountID === Types.noAccountID,
    noDisclaimer: s.noDisclaimer,
    username: s.username,
  }),
  'WalletHeaderTitle'
)(_HeaderTitle)

export const HeaderRightActions = Container.namedConnect(
  state => ({
    _accountID: Constants.getSelectedAccount(state),
    noDisclaimer: !state.wallets.acceptedDisclaimer,
  }),
  dispatch => ({
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
    onBuy: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['partners']})),
    onSettings: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['settings']})),
  }),
  (s, d, _) => ({
    loading: s._accountID === Types.noAccountID,
    noDisclaimer: s.noDisclaimer,
    onBuy: d.onBuy,
    onReceive: () => d._onReceive(s._accountID),
    onSettings: d.onSettings,
  }),
  'WalletHeaderRightActions'
)(_HeaderRightActions)
