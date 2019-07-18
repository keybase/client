import {compose, connect, lifecycle} from '../../../../util/container'
import * as ChatTypes from '../../../../constants/types/chat2'
import {getMeta} from '../../../../constants/chat2'
import {makeRetentionNotice} from '../../../../util/teams'
import {getCanPerform, hasCanPerform} from '../../../../constants/teams'
import {createGetTeamOperations} from '../../../../actions/teams-gen'
import RetentionNotice from '.'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'

type OwnProps = {
  conversationIDKey: ChatTypes.ConversationIDKey
  measure: (() => void)| null
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const meta = getMeta(state, ownProps.conversationIDKey)
  let canChange = true
  // We almost definitely already have the permissions, but check just in case something changes
  let _permissionsNeedLoad = false
  let _teamname = ''
  if (meta.teamType !== 'adhoc') {
    // we need to check for permission
    _teamname = meta.teamname
    _permissionsNeedLoad = !hasCanPerform(state, _teamname)
    canChange = getCanPerform(state, _teamname).setRetentionPolicy
  }
  return {
    _permissionsNeedLoad,
    _policy: meta.retentionPolicy,
    _teamPolicy: meta.teamRetentionPolicy,
    _teamType: meta.teamType,
    _teamname,
    canChange,
  }
}

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  _loadPermissions: (teamname: string) => dispatch(createGetTeamOperations({teamname})),
  onChange: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey: ownProps.conversationIDKey, tab: 'settings'},
            selected: 'chatInfoPanel',
          },
        ],
      })
    ),
})

const mergeProps = (stateProps, dispatchProps, _) => {
  const explanation = makeRetentionNotice(stateProps._policy, stateProps._teamPolicy, stateProps._teamType)
  return {
    ...stateProps,
    ...dispatchProps,
    explanation,
  }
}

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  lifecycle({
    componentDidMount() {
      this.props._permissionsNeedLoad && this.props._loadPermissions()
    },
    componentDidUpdate(prevProps) {
      if (
        this.props.canChange !== prevProps.canChange ||
        this.props._policy !== prevProps._policy ||
        this.props._teamPolicy !== prevProps._teamPolicy
      ) {
        this.props.measure && this.props.measure()
      }
    },
  } as any)
  // @ts-ignore
)(RetentionNotice)
