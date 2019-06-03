import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import ExportSecretKey from '.'

export type OwnProps = Container.RouteProps<
  {
    accountID: Types.AccountID
  },
  {}
>

const mapStateToProps = (state, ownProps) => {
  const accountID = Container.getRouteProps(ownProps, 'accountID')
  const account = Constants.getAccount(state, accountID)
  const secretKey = Constants.getSecretKey(state, accountID).stringValue()
  return {
    accountID,
    accountName: account.name,
    secretKey,
    username: state.config.username,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  _onClose: (accountID: Types.AccountID) => dispatch(RouteTreeGen.createNavigateUp()),
  _onLoadSecretKey: (accountID: Types.AccountID) => dispatch(WalletsGen.createExportSecretKey({accountID})),
  _onSecretKeySeen: (accountID: Types.AccountID) => dispatch(WalletsGen.createSecretKeySeen({accountID})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  onClose: () => dispatchProps._onClose(stateProps.accountID),
  onLoadSecretKey: () => dispatchProps._onLoadSecretKey(stateProps.accountID),
  onSecretKeySeen: () => dispatchProps._onSecretKeySeen(stateProps.accountID),
})

export default Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(ExportSecretKey)
