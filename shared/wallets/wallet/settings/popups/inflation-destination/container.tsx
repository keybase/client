import * as Container from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import logger from '../../../../../logger'
import InflationDestination from '.'

type OwnProps = Container.RouteProps<{accountID: Types.AccountID}>

export default Container.namedConnect(
  (state, ownProps: OwnProps) => {
    const accountID = Container.getRouteProps(ownProps, 'accountID', Types.noAccountID)
    return {
      _options: state.wallets.inflationDestinations,
      accountID,
      error: state.wallets.inflationDestinationError,
      inflationDestination: Constants.getInflationDestination(state, accountID),
    }
  },
  dispatch => ({
    _onClose: () => {
      dispatch(WalletsGen.createInflationDestinationReceivedError({error: ''}))
      dispatch(RouteTreeGen.createNavigateUp())
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
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    error: stateProps.error,
    inflationDestination: stateProps.inflationDestination,
    onClose: () => dispatchProps._onClose(),
    onSubmit: (address: string, name: string) => dispatchProps._onSubmit(stateProps.accountID, address, name),
    options: stateProps._options.toArray().map(o => o.toObject()),
  }),

  'InflationDestination'
)(InflationDestination)
