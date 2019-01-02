// @flow
import * as React from 'react'
import Wallets from './index'
import Onboarding from '../onboarding/container'
import {connect} from '../../util/container'

type OwnProps = {
  children: React.Node,
}

const mapStateToProps = state => ({
  acceptedDisclaimer: state.wallets.acceptedDisclaimer,
})

const mapDispatchToProps = dispatch => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  acceptedDisclaimer: stateProps.acceptedDisclaimer,
  children: ownProps.children,
})

// TODO: This component is used only on desktop, so merge it with
// WalletList and remove the isMobile checks.

const WalletsOrOnboarding = props =>
  props.acceptedDisclaimer ? <Wallets children={props.children} /> : <Onboarding />

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletsOrOnboarding)
