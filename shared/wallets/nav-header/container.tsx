import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderTitle as _HeaderTitle, HeaderRightActions as _HeaderRightActions} from '.'

const mapStateToPropsHeaderTitle = state => ({
  _account: Constants.getSelectedAccountData(state),
  noDisclaimer: !state.wallets.acceptedDisclaimer,
  username: state.config.username,
})

const mergePropsHeaderTitle = s => ({
  accountID: s._account.accountID,
  accountName: s._account.name,
  isDefault: s._account.isDefault,
  loading: s._account.accountID === Types.noAccountID,
  noDisclaimer: s.noDisclaimer,
  username: s.username,
})

export const HeaderTitle = Container.namedConnect(
  mapStateToPropsHeaderTitle,
  () => ({}),
  mergePropsHeaderTitle,
  'WalletHeaderTitle'
)(_HeaderTitle)

const mapStateToPropsHeaderRightActions = state => ({
  _accountID: Constants.getSelectedAccount(state),
  noDisclaimer: !state.wallets.acceptedDisclaimer,
})
const mapDispatchToPropsHeaderRightActions = dispatch => ({
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
const mergePropsHeaderRightActions = (s, d, o) => ({
  noDisclaimer: s.noDisclaimer,
  onReceive: () => d._onReceive(s._accountID),
})

export const HeaderRightActions = Container.namedConnect(
  mapStateToPropsHeaderRightActions,
  mapDispatchToPropsHeaderRightActions,
  mergePropsHeaderRightActions,
  'WalletHeaderRightActions'
)(_HeaderRightActions)
