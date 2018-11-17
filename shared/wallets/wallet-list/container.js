// @flow
import * as React from 'react'
import {WalletList, type Props} from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTree from '../../actions/route-tree'
import * as Styles from '../../styles'
import openURL from '../../util/open-url'
import {connect, isMobile} from '../../util/container'
import {getAccountIDs} from '../../constants/wallets'
import Onboarding from '../onboarding/container'

type OwnProps = {style: Styles.StylesCrossPlatform}

const mapStateToProps = state => ({
  acceptedDisclaimer: state.wallets.acceptedDisclaimer,
  accounts: getAccountIDs(state),
})

const mapDispatchToProps = dispatch => ({
  onAddNew: () => {
    dispatch(
      RouteTree.navigateAppend([
        {props: {showOnCreation: true, backButton: isMobile}, selected: 'createNewAccount'},
      ])
    )
  },
  onBack: isMobile ? () => dispatch(RouteTree.navigateUp()) : null,
  onLinkExisting: () => {
    dispatch(RouteTree.navigateAppend([{props: {showOnCreation: true}, selected: 'linkExisting'}]))
  },
  onWhatIsStellar: () => openURL('https://keybase.io/what-is-stellar'),
  refresh: () => dispatch(WalletsGen.createLoadAccounts()),
})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => ({
  acceptedDisclaimer: stateProps.acceptedDisclaimer,
  accountIDs: stateProps.accounts.toArray(),
  onAddNew: dispatchProps.onAddNew,
  onLinkExisting: dispatchProps.onLinkExisting,
  onWhatIsStellar: dispatchProps.onWhatIsStellar,
  onBack: dispatchProps.onBack,
  refresh: dispatchProps.refresh,
  style: ownProps.style,
  title: 'Wallets',
})

const WalletListOrOnboarding = (props: Props) =>
  props.acceptedDisclaimer ? <WalletList {...props} /> : <Onboarding />

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletListOrOnboarding)
