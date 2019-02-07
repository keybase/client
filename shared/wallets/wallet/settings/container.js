// @flow
import Settings, {type SettingsProps} from '.'
import {compose, namedConnect, safeSubmit, type RouteProps} from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'

type OwnProps = RouteProps<{accountID: Types.AccountID}, {}>

const mapStateToProps = (state, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  const account = Constants.getAccount(state, accountID)
  const name = account.name
  const mobileOnlyEditable = account.mobileOnlyEditable
  const me = state.config.username || ''
  const user = account.isDefault ? me : ''
  const currencies = Constants.getDisplayCurrencies(state)
  const currency = Constants.getDisplayCurrency(state, accountID)
  const currencyWaiting = anyWaiting(
    state,
    Constants.changeDisplayCurrencyWaitingKey,
    Constants.getDisplayCurrencyWaitingKey(accountID)
  )
  const saveCurrencyWaiting = anyWaiting(state, Constants.changeDisplayCurrencyWaitingKey)
  const mobileOnlyMode = state.wallets.mobileOnlyMap.get(accountID, false)
  const mobileOnlyWaiting = anyWaiting(state, Constants.setAccountMobileOnlyWaitingKey(accountID))

  const inflationDest = Constants.getInflationDestination(state, accountID)
  return {
    accountID,
    currencies,
    currency,
    currencyWaiting,
    inflationDestination:
      inflationDest === Constants.noAccountInflationDestination
        ? ''
        : inflationDest.name || inflationDest.accountID,
    isDefault: account.isDefault,
    mobileOnlyEditable,
    mobileOnlyMode,
    mobileOnlyWaiting,
    name,
    saveCurrencyWaiting,
    user,
  }
}

const mapDispatchToProps = (dispatch, {routeProps, navigateUp, navigateAppend}) => ({
  _onBack: (accountID: Types.AccountID) => {
    dispatch(navigateUp())
    dispatch(WalletsGen.createLoadPayments({accountID}))
  },
  _onChangeMobileOnlyMode: (accountID: Types.AccountID, enabled: boolean) =>
    dispatch(WalletsGen.createChangeMobileOnlyMode({accountID, enabled})),
  _onDelete: (accountID: Types.AccountID) =>
    dispatch(navigateAppend([{props: {accountID}, selected: 'removeAccount'}])),
  _onEditName: (accountID: Types.AccountID) =>
    dispatch(navigateAppend([{props: {accountID}, selected: 'renameAccount'}])),
  _onSetDefault: (accountID: Types.AccountID) =>
    dispatch(navigateAppend([{props: {accountID}, selected: 'setDefaultAccount'}])),
  _onSetDisplayCurrency: (accountID: Types.AccountID, code: Types.CurrencyCode) =>
    dispatch(WalletsGen.createChangeDisplayCurrency({accountID, code})),
  _onSetupInflation: (accountID: Types.AccountID) =>
    dispatch(navigateAppend([{props: {accountID}, selected: 'setInflation'}])),
  _refresh: () => {
    const accountID = routeProps.get('accountID')
    dispatch(WalletsGen.createLoadDisplayCurrencies())
    dispatch(WalletsGen.createLoadInflationDestination({accountID}))
    dispatch(WalletsGen.createLoadDisplayCurrency({accountID}))
    dispatch(WalletsGen.createLoadMobileOnlyMode({accountID}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps): SettingsProps => ({
  ...stateProps,
  onBack: () => dispatchProps._onBack(stateProps.accountID),
  onCurrencyChange: (code: Types.CurrencyCode) =>
    dispatchProps._onSetDisplayCurrency(stateProps.accountID, code),
  onDelete: () => dispatchProps._onDelete(stateProps.accountID),
  onEditName: () => dispatchProps._onEditName(stateProps.accountID),
  onMobileOnlyModeChange: (enabled: boolean) =>
    dispatchProps._onChangeMobileOnlyMode(stateProps.accountID, enabled),
  onSetDefault: () => dispatchProps._onSetDefault(stateProps.accountID),
  onSetupInflation: () => dispatchProps._onSetupInflation(stateProps.accountID),
  refresh: () => dispatchProps._refresh(),
})

export default compose(
  namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'Settings'),
  safeSubmit(['onCurrencyChange'], ['currencyWaiting'])
)(Settings)
