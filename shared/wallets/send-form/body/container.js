// @flow
import Body from '.'
import {compose, connect, setDisplayName, type TypedState} from '../../../util/container'
import {bannerLevelToBackground} from '../../../constants/wallets'

const mapStateToProps = (state: TypedState) => ({
  banners: (state.wallets.builtPayment.banners || []).map(banner => ({
    bannerBackground: bannerLevelToBackground(banner.level),
    bannerText: banner.message,
  })),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('Body'))(Body)
