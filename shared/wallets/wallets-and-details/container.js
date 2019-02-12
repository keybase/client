// @flow
import * as React from 'react'
import WalletsAndDetails from '.'
import Onboarding from '../onboarding/container'
import {connect, type RouteProps} from '../../util/container'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  acceptedDisclaimer: state.wallets.acceptedDisclaimer,
})

const mapDispatchToProps = dispatch => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  acceptedDisclaimer: stateProps.acceptedDisclaimer,
  navigateAppend: ownProps.navigateAppend,
  navigateUp: ownProps.navigateUp,
})

const WalletsOrOnboarding = props =>
  props.acceptedDisclaimer ? (
    <WalletsAndDetails navigateUp={props.navigateUp} navigateAppend={props.navigateAppend} />
  ) : (
    <Onboarding />
  )

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletsOrOnboarding)
