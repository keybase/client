// @flow
import * as React from 'react'
import WalletList from './index'
import Onboarding from '../onboarding/container'
import {connect} from '../../util/container'

type Props = {
  acceptedDisclaimer: boolean,
  children: React.Node,
}

const mapStateToProps = state => ({
  acceptedDisclaimer: state.wallets.acceptedDisclaimer,
})

const mapDispatchToProps = dispatch => ({})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => ({
  acceptedDisclaimer: stateProps.acceptedDisclaimer,
  children: ownProps.children,
})

const WalletOrOnboarding = (props: Props) =>
  props.acceptedDisclaimer ? <WalletList children={props.children} /> : <Onboarding />

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletOrOnboarding)
