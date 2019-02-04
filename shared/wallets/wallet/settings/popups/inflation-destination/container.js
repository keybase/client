// @flow
import {namedConnect, type RouteProps} from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import logger from '../../../../../logger'
import InflationDestination from '.'

type OwnProps = RouteProps<{accountID: Types.AccountID}, {}>

const mapStateToProps = (state, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  return {
    _options: state.wallets.inflationDestinations,
    accountID,
    error: state.wallets.inflationDestinationError,
    inflationDestination: Constants.getInflationDestination(state, accountID),
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onClose: () => {
    dispatch(WalletsGen.createInflationDestinationReceivedError({error: ''}))
    dispatch(ownProps.navigateUp())
  },
  _onSubmit: (accountID: Types.AccountID, destination: string, name: string) => {
    if (!destination) {
      logger.warn('Set inflation: bailing on empty dest accountID')
      return
    }
    dispatch(
      WalletsGen.createSetInflationDestination({
        accountID,
        destination: Types.stringToAccountID(destination),
        name,
      })
    )
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  error: stateProps.error,
  inflationDestination: stateProps.inflationDestination,
  onClose: () => dispatchProps._onClose(),
  onSubmit: (address: string, name: string) => dispatchProps._onSubmit(stateProps.accountID, address, name),
  options: stateProps._options.toArray().map(o => o.toObject()),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'InflationDestination'
)(InflationDestination)
