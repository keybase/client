import * as Types from '../../../../constants/types/chat2'
import {connect, TypedState, TypedDispatch} from '../../../../util/container'
import LocationPopup from '.'

const noPreview = {
  locationAccuracy: undefined,
  locationMap: undefined,
}

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const location = state.chat2.locationPreview || noPreview
  return {
    ...location,
    conversationIDKey: ownProps.conversationIDKey,
  }
}

const mapDispatchToProps = (dispatch: TypedDispatch, ownProps: OwnProps) => ({
  onLocationShare: (duration: number) => {},
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps) => {
    return {
      ...stateProps,
      ...dispatchProps,
    }
  }
)(LocationPopup)
