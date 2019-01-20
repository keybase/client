// @flow
import * as React from 'react'
import * as WalletsGen from '../../actions/wallets-gen'
import Wallets from './index'
import Onboarding from '../onboarding/container'
import {connect} from '../../util/container'

type OwnProps = {
  children: React.Node,
}

const mapStateToProps = state => ({
  acceptedDisclaimer: state.wallets.acceptedDisclaimer,
})

const mapDispatchToProps = dispatch => ({
  reload: () => dispatch(WalletsGen.createLoadAccounts({reason: 'initial-load'})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  acceptedDisclaimer: stateProps.acceptedDisclaimer,
  children: ownProps.children,
  reload: dispatchProps.reload,
})

const WalletsOrOnboarding = props =>
  props.acceptedDisclaimer ? <Wallets children={props.children} reload={props.reload} /> : <Onboarding />

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletsOrOnboarding)
