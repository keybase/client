// @flow
import {WalletList, type Props} from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'
import openURL from '../../util/open-url'
import {connect, isMobile} from '../../util/container'
import {getAccountIDs} from '../../constants/wallets'

type OwnProps = {style: Styles.StylesCrossPlatform}

const mapStateToProps = state => ({
  accounts: getAccountIDs(state),
})

const mapDispatchToProps = dispatch => ({
  onAddNew: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {backButton: isMobile, showOnCreation: true}, selected: 'createNewAccount'}],
      })
    )
  },
  onBack: isMobile ? () => dispatch(RouteTreeGen.createNavigateUp()) : null,
  onLinkExisting: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {showOnCreation: true}, selected: 'linkExisting'}]})
    )
  },
  onWhatIsStellar: () => openURL('https://keybase.io/what-is-stellar'),
  refresh: () => dispatch(WalletsGen.createLoadAccounts()),
})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => ({
  accountIDs: stateProps.accounts.toArray(),
  onAddNew: dispatchProps.onAddNew,
  onBack: dispatchProps.onBack,
  onLinkExisting: dispatchProps.onLinkExisting,
  onWhatIsStellar: dispatchProps.onWhatIsStellar,
  refresh: dispatchProps.refresh,
  style: ownProps.style,
  title: 'Wallets',
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletList)
