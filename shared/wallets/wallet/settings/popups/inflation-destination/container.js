// @flow
import {namedConnect, type RouteProps} from '../../../../../util/container'
import * as Types from '../../../../../constants/types/wallets'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import InflationDestination from '.'

type OwnProps = RouteProps<{accountID: Types.AccountID}, {}>

const mapStateToProps = (state, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  return {
    _options: state.wallets.inflationDestinations,
    accountID,
    inflationDestination: state.wallets.inflationDestination,
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onClose: () => dispatch(ownProps.navigateUp()),
  _onSubmit: (accountID: Types.AccountID, destination: string) => {
    dispatch(WalletsGen.createSetInflationDestination({accountID, destination}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  inflationDestination: stateProps.inflationDestination,
  onClose: () => dispatchProps._onClose(),
  onSubmit: (address: string) => dispatchProps._onSubmit(stateProps.accountID, address),
  options: stateProps._options.toArray().map(o => o.toObject()),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'InflationDestination'
)(InflationDestination)
