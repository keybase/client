import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Container from '../../../../util/container'
import HiddenString from '../../../../util/hidden-string'
import LocationPopup from '.'

type OwnProps = Container.RouteProps<{conversationIDKey: Types.ConversationIDKey}>

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const conversationIDKey = Container.getRouteProps(
    ownProps,
    'conversationIDKey',
    Constants.noConversationIDKey
  )
  return {
    _conversationIDKey: conversationIDKey,
    httpSrvAddress: state.config.httpSrvAddress,
    httpSrvToken: state.config.httpSrvToken,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onLocationShare: (duration: string, conversationIDKey: Types.ConversationIDKey) => {
    dispatch(
      Chat2Gen.createMessageSend({
        conversationIDKey,
        text: duration ? new HiddenString(`/location live ${duration}`) : new HiddenString('/location'),
      })
    )
  },
})

export default Container.connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps) => {
  return {
    httpSrvAddress: stateProps.httpSrvAddress,
    httpSrvToken: stateProps.httpSrvToken,
    onLocationShare: (duration: string) =>
      dispatchProps._onLocationShare(duration, stateProps._conversationIDKey),
  }
})(LocationPopup)
