// @flow
import {connect, type TypedState} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import ExportSecretKey from '.'

export type OwnProps = {
  accountID: Types.AccountID,
}

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  const secretKey = Constants.getSecretKey(state, accountID).stringValue()
  return {
    accountID,
    secretKey,
    username: state.config.username,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  _onClose: (accountID: Types.AccountID) => {
    dispatch(WalletsGen.createSecretKeySeen({accountID}))
    dispatch(navigateUp())
  },
  _onLoadSecretKey: (accountID: Types.AccountID) => dispatch(WalletsGen.createExportSecretKey({accountID})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  onClose: () => dispatchProps._onClose(stateProps.accountID),
  onLoadSecretKey: () => dispatchProps._onLoadSecretKey(stateProps.accountID),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(ExportSecretKey)
