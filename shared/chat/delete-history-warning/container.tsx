import * as Chat2Gen from '../../actions/chat2-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import DeleteHistoryWarning from '.'

type OwnProps = Container.RouteProps2<'chatDeleteHistoryWarning'>

export default (ownProps: OwnProps) => {
  const conversationIDKey = ownProps.route.params.conversationIDKey
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onDeleteHistory = () => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(Chat2Gen.createMessageDeleteHistory({conversationIDKey}))
  }
  const props = {
    onCancel,
    onDeleteHistory,
  }
  return <DeleteHistoryWarning {...props} />
}
