// @flow
import {WalletList, type Props} from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'
import openURL from '../../util/open-url'
import {connect} from '../../util/container'
import {getAccountIDs, loadAccountsWaitingKey} from '../../constants/wallets'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = {style: Styles.StylesCrossPlatform}

const mapStateToProps = state => ({
  accounts: getAccountIDs(state),
  loading: anyWaiting(state, loadAccountsWaitingKey),
})

const mapDispatchToProps = dispatch => ({
  onAddNew: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {backButton: false, showOnCreation: true}, selected: 'createNewAccount'}],
      })
    )
  },
  onLinkExisting: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {showOnCreation: true}, selected: 'linkExisting'}]})
    )
  },
  onWhatIsStellar: () => openURL('https://keybase.io/what-is-stellar'),
})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => ({
  accountIDs: stateProps.accounts.toArray(),
  loading: stateProps.loading,
  onAddNew: dispatchProps.onAddNew,
  onLinkExisting: dispatchProps.onLinkExisting,
  onWhatIsStellar: dispatchProps.onWhatIsStellar,
  style: ownProps.style,
  title: 'Wallets',
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletList)
