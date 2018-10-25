// @flow
import Settings, {type SettingsProps} from '.'
import {compose, connect, lifecycle, setDisplayName, safeSubmit} from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'

const mapStateToProps = (state, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  const account = Constants.getAccount(state, accountID)
  const name = account.name
  const me = state.config.username || ''
  const user = account.isDefault ? me : ''
  const currencies = Constants.getDisplayCurrencies(state)
  const currency = Constants.getDisplayCurrency(state, accountID)
  const currencyWaiting = anyWaiting(state, Constants.changeDisplayCurrencyWaitingKey)

  return {
    accountID,
    currencies,
    currency,
    currencyWaiting,
    isDefault: account.isDefault,
    name,
    user,
  }
}

const mapDispatchToProps = (dispatch, {routeProps, navigateUp, navigateAppend}) => ({
  _onBack: (accountID: Types.AccountID) => {
    dispatch(navigateUp())
    dispatch(WalletsGen.createLoadPayments({accountID}))
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
  _onEditName: (accountID: Types.AccountID) =>
    dispatch(navigateAppend([{props: {accountID}, selected: 'renameAccount'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps): SettingsProps => ({
  ...stateProps,
  onBack: () => dispatchProps._onBack(stateProps.accountID),
  onCurrencyChange: (code: Types.CurrencyCode) =>
    dispatchProps._onSetDisplayCurrency(stateProps.accountID, code),
  onDelete: () => dispatchProps._onDelete(stateProps.accountID),
  onEditName: () => dispatchProps._onEditName(stateProps.accountID),
  onSetDefault: () => dispatchProps._onSetDefault(stateProps.accountID),
  refresh: () => dispatchProps._refresh(),
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  lifecycle({
    componentDidMount() {
      this.props.refresh()
    },
  }),
  setDisplayName('Settings'),
  safeSubmit(['onCurrencyChange'], ['currencyWaiting'])
)(Settings)
