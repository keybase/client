// @flow
import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderTitle as _HeaderTitle, HeaderRightActions as _HeaderRightActions} from '.'

const mapStateToPropsHeaderTitle = state => ({
  _account: Constants.getSelectedAccountData(state),
  username: state.config.username,
})

const mergePropsHeaderTitle = s => ({
  accountID: s._account.accountID,
  accountName: s._account.name,
  isDefault: s._account.isDefault,
  username: s.username,
})

export const HeaderTitle = Container.namedConnect<{||}, _, _, _, _>(
  mapStateToPropsHeaderTitle,
  () => ({}),
  mergePropsHeaderTitle,
  'WalletHeaderTitle'
)(_HeaderTitle)

const mapStateToPropsHeaderRightActions = state => ({_accountID: Constants.getSelectedAccount(state)})
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
const mergePropsHeaderRightActions = (s, d, o) => ({onReceive: () => d._onReceive(s._accountID)})

export const HeaderRightActions = Container.namedConnect<{||}, _, _, _, _>(
  mapStateToPropsHeaderRightActions,
  mapDispatchToPropsHeaderRightActions,
  mergePropsHeaderRightActions,
  'WalletHeaderRightActions'
)(_HeaderRightActions)
