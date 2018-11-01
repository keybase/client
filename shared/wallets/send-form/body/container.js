// @flow
import {SendBody as SendBodyComponent, RequestBody as RequestBodyComponent} from '.'
import {namedConnect} from '../../../util/container'
import {bannerLevelToBackground} from '../../../constants/wallets'

const mapStateToProps = state => ({
  banners: state.wallets.building.isRequest
    ? state.wallets.builtRequest.banners
    : state.wallets.builtPayment.banners,
})

const mapDispatchToProps = dispatch => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  banners: (stateProps.banners || []).map(banner => ({
    bannerBackground: bannerLevelToBackground(banner.level),
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
