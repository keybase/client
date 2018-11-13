// @flow
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as Route from '../../../actions/route-tree'
import {connect} from '../../../util/container'
import Error from '.'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
|}

const mapStateToProps = (state, {conversationIDKey}: OwnProps) => ({
  text: Constants.getMeta(state, conversationIDKey).snippet,
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(Route.navigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  onBack: dispatchProps.onBack,
  text: stateProps.text,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Error)
