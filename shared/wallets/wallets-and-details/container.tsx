import * as React from 'react'
import WalletsAndDetails from '.'
import Onboarding from '../onboarding/container'
import {connect, RouteProps} from '../../util/container'

type OwnProps = RouteProps<{}, {}> & {
  children: React.ReactNode
}

const mapStateToProps = state => ({
  acceptedDisclaimer: state.wallets.acceptedDisclaimer,
})

const mapDispatchToProps = dispatch => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  acceptedDisclaimer: stateProps.acceptedDisclaimer,
  children: ownProps.children,
  navigateAppend: ownProps.navigateAppend,
  navigateUp: ownProps.navigateUp,
})

const WalletsOrOnboarding = props =>
  props.acceptedDisclaimer ? (
    <WalletsAndDetails navigateUp={props.navigateUp} navigateAppend={props.navigateAppend}>
      {props.children}
    </WalletsAndDetails>
  ) : (
    <Onboarding />
  )

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletsOrOnboarding)
