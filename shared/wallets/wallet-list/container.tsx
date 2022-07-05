import {WalletList} from '.'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = {
  style: Styles.StylesCrossPlatform
}

export default Container.connect(
  state => ({
    accounts: Constants.getAccountIDs(state),
    loading: anyWaiting(state, Constants.loadAccountsWaitingKey),
  }),
  dispatch => ({
    onAddNew: () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {backButton: false, showOnCreation: true}, selected: 'createNewAccount'}],
        })
      ),
    onLinkExisting: () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({path: [{props: {showOnCreation: true}, selected: 'linkExisting'}]})
      ),
    onWhatIsStellar: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['whatIsStellarModal']})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    accountIDs: stateProps.accounts,
    loading: stateProps.loading,
    onAddNew: dispatchProps.onAddNew,
    onLinkExisting: dispatchProps.onLinkExisting,
    onWhatIsStellar: dispatchProps.onWhatIsStellar,
    style: ownProps.style,
    title: 'Wallets',
  })
)(WalletList)
