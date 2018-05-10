// @flow
import * as Constants from '../../../constants/chat2'
import * as Route from '../../../actions/route-tree'
import {connect, type TypedState} from '../../../util/container'
import Error from '.'

const mapStateToProps = (state: TypedState, {conversationIDKey}) => {
  return {
    text: Constants.getMeta(state, conversationIDKey).snippet,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(Route.navigateUp()),
})

export default connect(mapStateToProps, mapDispatchToProps)(Error)
