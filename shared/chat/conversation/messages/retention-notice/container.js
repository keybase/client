// @flow
import {compose, connect, lifecycle, type TypedState} from '../../../../util/container'
import * as ChatTypes from '../../../../constants/types/chat2'
import {getMeta} from '../../../../constants/chat2'
import {getCanPerform, hasCanPerform} from '../../../../constants/teams'
import {createGetTeamOperations} from '../../../../actions/teams-gen'
import RetentionNotice from '.'

type OwnProps = {conversationIDKey: ChatTypes.ConversationIDKey}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
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
    _teamname,
    canChange,
    policy: meta.retentionPolicy,
    teamPolicy: meta.teamRetentionPolicy,
    teamType: meta.teamType,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _loadPermissions: (teamname: string) => dispatch(createGetTeamOperations({teamname})),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount() {
      this.props._permissionsNeedLoad && this.props._loadPermissions()
    },
  })
)(RetentionNotice)
