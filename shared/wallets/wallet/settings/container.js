// @flow
import Settings, {type SettingsProps} from '.'
import {compose, namedConnect, lifecycle, safeSubmit, type RouteProps} from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'

type OwnProps = RouteProps<{accountID: Types.AccountID}, {}>

const mapStateToProps = (state, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  const account = Constants.getAccount(state, accountID)
  const name = account.name
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

  return {
    accountID,
    currencies,
    currency,
    currencyWaiting,
    isDefault: account.isDefault,
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
  _onDelete: (accountID: Types.AccountID) =>
    dispatch(
      navigateAppend([
        {
          props: {accountID},
          selected: 'removeAccount',
        },
      ])
    ),
  _onEditName: (accountID: Types.AccountID) =>
    dispatch(navigateAppend([{props: {accountID}, selected: 'renameAccount'}])),
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
  _refresh: () => {
    dispatch(WalletsGen.createLoadDisplayCurrencies())
    dispatch(WalletsGen.createLoadDisplayCurrency({accountID: routeProps.get('accountID')}))
  },
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
  namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'Settings'),
  lifecycle({
    componentDidMount() {
      this.props.refresh()
    },
  }),
  safeSubmit(['onCurrencyChange'], ['currencyWaiting'])
)(Settings)
