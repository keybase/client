// @flow
import {namedConnect, type RouteProps} from '../../../../../util/container'
import * as Types from '../../../../../constants/types/wallets'
// import * as WalletsGen from '../../../../../actions/wallets-gen'
import InflationDestination from '.'

type OwnProps = RouteProps<{accountID: Types.AccountID}, {}>

const mapStateToProps = (state, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  const options = [] // TODO
  return {accountID, options}
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onClose: () => dispatch(ownProps.navigateUp()),
  _onSubmit: (accountID: Types.AccountID, address: string) => {
    // TODO
    // dispatch( WalletsGen.createChangeInflation({ accountID, address }))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  option: stateProps.options,
  onClose: () => dispatchProps._onClose(),
  onSubmit: (address: string) => dispatchProps._onSubmit(stateProps.accountID, address),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'InflationDestination'
)(InflationDestination)
