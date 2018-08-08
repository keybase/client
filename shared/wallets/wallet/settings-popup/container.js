// @flow
import SettingsPopup from '.'
import {compose, connect, lifecycle, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'


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
  return {
    name,
    user,
    isDefault: account.isDefault,
    currency:  asset && asset.assetCode ? asset.assetCode : 'TBD',
    currencies: state.currencies,
    onDelete: () => {},
    onSetDefault: () => {},
    onEditName: () => {},
    onCurrencyChange: (currency: string) => {},
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  refresh: () => dispatch(WalletsGen.createLoadDisplayCurrencies()),
})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => ({
  ...stateProps,
  refresh: dispatchProps.refresh,
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
