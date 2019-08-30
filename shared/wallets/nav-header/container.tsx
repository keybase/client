import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderTitle as _HeaderTitle, HeaderRightActions as _HeaderRightActions} from '.'

const mapStateToPropsHeaderTitle = state => ({
  _account: Constants.getSelectedAccountData(state),
  airdropSelected: Constants.getAirdropSelected(),
  isInAirdrop: state.wallets.airdropState === 'accepted',
  noDisclaimer: !state.wallets.acceptedDisclaimer,
  username: state.config.username,
})

const mergePropsHeaderTitle = s => ({
  accountID: s._account.accountID,
  accountName: s._account.name,
  airdropSelected: s.airdropSelected,
  isDefault: s._account.isDefault,
  isInAirdrop: s.isInAirdrop,
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
  airdropSelected: Constants.getAirdropSelected(),
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
  onSettings: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['settings']})),
})
const mergePropsHeaderRightActions = (s, d, _) => ({
  airdropSelected: s.airdropSelected,
  loading: s._accountID === Types.noAccountID,
  noDisclaimer: s.noDisclaimer,
  onReceive: () => d._onReceive(s._accountID),
  onSettings: d.onSettings,
})

export const HeaderRightActions = Container.namedConnect(
  mapStateToPropsHeaderRightActions,
  mapDispatchToPropsHeaderRightActions,
  mergePropsHeaderRightActions,
  'WalletHeaderRightActions'
)(_HeaderRightActions)
