import * as React from 'react'
import WalletsAndDetails from '.'
import Onboarding from '../onboarding/container'
import {connect} from '../../util/container'

type OwnProps = {children: React.ReactNode}

type Props = {
  acceptedDisclaimer: boolean
  children: React.ReactNode
}

const WalletsOrOnboarding = (props: Props) =>
  props.acceptedDisclaimer ? (
    <WalletsAndDetails>{props.children}</WalletsAndDetails>
  ) : (
    <Onboarding nextScreen="openWallet" />
  )

export default connect(
  state => ({acceptedDisclaimer: state.wallets.acceptedDisclaimer}),
  () => ({}),
  (stateProps, _, ownProps: OwnProps) => ({
    acceptedDisclaimer: stateProps.acceptedDisclaimer,
    children: ownProps.children,
  })
)(WalletsOrOnboarding)
