// @flow
import SettingsPopup from '.'
import {compose, connect, lifecycle, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'


type OwnProps = {
  accountID: Types.AccountID,
}

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  const account = Constants.getAccount(state, accountID)
  const asset = Constants.getAssets(state, accountID).get(0)
  const name = account.name || accountID || account.accountID
  const me = state.config.username || ''
  const user = account.isDefault ? me : ''
  const currencies = Constants.getDisplayCurrencies(state)
  const currency = Constants.getDisplayCurrency(state, accountID)
  return {
    accountID,
    name,
    user,
    isDefault: account.isDefault,
    currency,
    currencies,
    onEditName: () => {},
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => {
  return {
    _refresh: () => {
      dispatch(WalletsGen.createLoadDisplayCurrencies())
      dispatch(WalletsGen.createLoadDisplayCurrency({accountID: routeProps.get('accountID')}))
    },
    _onDelete: (accountID: Types.AccountID) => dispatch(WalletsGen.createDeleteAccount({accountID})),
    _onSetDefault: (accountID: Types.AccountID) => dispatch(WalletsGen.createSetAccountAsDefault({accountID})),
    //_onSetName: (accountID: Types.AccountID, name: string) => dispatch(WalletsGen.setName(accountID, name)),
    _onSetDisplayCurrency: (accountID: Types.AccountID, code: Types.CurrencyCode) => dispatch(WalletsGen.createChangeDisplayCurrency({accountID, code})),
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps): Props => ({
  ...stateProps,
  refresh: () => dispatchProps._refresh(),
  onDelete: () => dispatchProps._onDelete(stateProps.accountID),
  onSetDefault: () => dispatchProps._onSetDefault(stateProps.accountID),
  onSetName: (name: string) => dispatchProps._onEditName(stateProps.accountID, name),
  onCurrencyChange: (code: Types.CurrencyCode) => dispatchProps._onSetDisplayCurrency(stateProps.accountID, code),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount() {
      this.props.refresh()
    },
  }),
  setDisplayName('SettingsPopup')
)(SettingsPopup)
