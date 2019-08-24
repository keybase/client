import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {connect} from '../../../util/container'
import Error from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

const mapStateToProps = (state, {conversationIDKey}: OwnProps) => ({
  text: Constants.getMeta(state, conversationIDKey).snippet,
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  onBack: dispatchProps.onBack,
  text: stateProps.text,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Error)
