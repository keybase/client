// @flow
import {SendBody as SendBodyComponent, RequestBody as RequestBodyComponent} from '.'
import {namedConnect} from '../../../util/container'
import * as Constants from '../../../constants/wallets'

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

export const SendBody = namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ConnectedSendBody')(
  SendBodyComponent
)

export const RequestBody = namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedRequestBody'
)(RequestBodyComponent)
