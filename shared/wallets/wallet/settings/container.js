// @flow
import Settings, {type SettingsProps} from '.'
import * as Container from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

type OwnProps = Container.RouteProps<{}, {}>

const mapStateToProps = state => {
  const accountID = Constants.getSelectedAccount(state)
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
  const canSubmitTx = account.canSubmitTx
  const thisDeviceIsLockedOut = account.deviceReadOnly
  const inflationDest = Constants.getInflationDestination(state, accountID)
  return {
    accountID,
    canSubmitTx,
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
    thisDeviceIsLockedOut,
    user,
  }
}

const mapDispatchToProps = dispatch => ({
  _onBack: (accountID: Types.AccountID) => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(WalletsGen.createLoadPayments({accountID}))
  },
  _onChangeMobileOnlyMode: (accountID: Types.AccountID, enabled: boolean) =>
    dispatch(WalletsGen.createChangeMobileOnlyMode({accountID, enabled})),
  _onDelete: (accountID: Types.AccountID) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'removeAccount'}]})),
  _onEditName: (accountID: Types.AccountID) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'renameAccount'}]})),
  _onSetDefault: (accountID: Types.AccountID) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'setDefaultAccount'}]})
    ),
  _onSetDisplayCurrency: (accountID: Types.AccountID, code: Types.CurrencyCode) =>
    dispatch(WalletsGen.createChangeDisplayCurrency({accountID, code})),
  _onSetupInflation: (accountID: Types.AccountID) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'setInflation'}]})),
  _refresh: accountID => {
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
  refresh: () => dispatchProps._refresh(stateProps.accountID),
})

export default Container.compose(
  Container.namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'Settings'),
  Container.safeSubmit(['onCurrencyChange'], ['currencyWaiting'])
)(Settings)
