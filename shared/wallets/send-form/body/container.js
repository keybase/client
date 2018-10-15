// @flow
import {SendBody as SendBodyComponent, RequestBody as RequestBodyComponent} from '.'
import {compose, connect, setDisplayName} from '../../../util/container'
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

const connector = connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)

export const SendBody = compose(
  connector,
  setDisplayName('ConnectedSendBody')
)(SendBodyComponent)

export const RequestBody = compose(
  connector,
  setDisplayName('ConnectedRequestBody')
)(RequestBodyComponent)
