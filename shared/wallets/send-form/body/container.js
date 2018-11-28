// @flow
import {SendBody as SendBodyComponent, RequestBody as RequestBodyComponent} from '.'
import {namedConnect} from '../../../util/container'
import * as Constants from '../../../constants/wallets'

type OwnProps = {||}

const mapStateToProps = state => ({
  banners: state.wallets.building.isRequest
    ? state.wallets.builtRequest.banners
    : state.wallets.builtPayment.banners,
})

const mapDispatchToProps = dispatch => ({})

const mergeProps = (stateProps, dispatchProps) => ({
  ...dispatchProps,
  banners: (stateProps.banners || []).map(banner => ({
    bannerBackground: Constants.bannerLevelToBackground(banner.level),
    bannerText: banner.message,
  })),
})

export const SendBody = namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedSendBody'
)(SendBodyComponent)

export const RequestBody = namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedRequestBody'
)(RequestBodyComponent)
