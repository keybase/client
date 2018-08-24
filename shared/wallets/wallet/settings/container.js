// @flow
import Settings, {type SettingsProps} from '.'
import {
  compose,
  connect,
  lifecycle,
  setDisplayName,
  type TypedState,
  type Dispatch,
} from '../../../util/container'
import {navigateAppend, navigateUp} from '../../../actions/route-tree'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  const account = Constants.getAccount(state, accountID)
  const name = account.name || accountID || account.accountID
  const me = state.config.username || ''
  const user = account.isDefault ? me : ''
  const currencies = Constants.getDisplayCurrencies(state)
  const currency = Constants.getDisplayCurrency(state, accountID)
  return {
    accountID,
    currencies,
    currency,
    isDefault: account.isDefault,
    name,
    onEditName: () => {},
    user,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => {
  return {
    _onBack: (accountID: Types.AccountID) => {
      dispatch(navigateUp())
      dispatch(WalletsGen.createRefreshPayments({accountID}))
    },
    _refresh: () => {
      dispatch(WalletsGen.createLoadDisplayCurrencies())
      dispatch(WalletsGen.createLoadDisplayCurrency({accountID: routeProps.get('accountID')}))
    },
    _onDelete: (accountID: Types.AccountID) =>
      dispatch(
        navigateAppend([
          {
            props: {accountID},
            selected: 'removeAccount',
          },
        ])
      ),
    _onSetDefault: (accountID: Types.AccountID) =>
      dispatch(
        navigateAppend([
          {
            props: {accountID},
            selected: 'setDefaultAccount',
          },
        ])
      ),
    _onSetDisplayCurrency: (accountID: Types.AccountID, code: Types.CurrencyCode) =>
      dispatch(WalletsGen.createChangeDisplayCurrency({accountID, code})),
    onAddNew: () => {},
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps): SettingsProps => ({
  ...stateProps,
  onBack: () => dispatchProps._onBack(stateProps.accountID),
  refresh: () => dispatchProps._refresh(),
  onDelete: () => dispatchProps._onDelete(stateProps.accountID),
  onSetDefault: () => dispatchProps._onSetDefault(stateProps.accountID),
  onCurrencyChange: (code: Types.CurrencyCode) =>
    dispatchProps._onSetDisplayCurrency(stateProps.accountID, code),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount() {
      this.props.refresh()
    },
  }),
  setDisplayName('Settings')
)(Settings)
