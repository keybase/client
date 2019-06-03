import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Types from '../../../../constants/types/chat2'
import * as TeamTypes from '../../../../constants/types/teams'
import * as TeamConstants from '../../../../constants/teams'
import MinWriterRole from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  isSmallTeam: boolean
}

const emptyProps = {
  canSetMinWriterRole: false,
  minWriterRole: 'reader',
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const meta = Constants.getMeta(state, ownProps.conversationIDKey)
  if (!meta.teamname) {
    return emptyProps
  }
  const canPerform = TeamConstants.getCanPerform(state, meta.teamname)
  return {
    canSetMinWriterRole: canPerform.setMinWriterRole,
    minWriterRole: meta.minWriterRole,
  }
}

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onSetNewRole: (role: TeamTypes.TeamRoleType) =>
    dispatch(Chat2Gen.createSetMinWriterRole({conversationIDKey: ownProps.conversationIDKey, role})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  canSetMinWriterRole: stateProps.canSetMinWriterRole,
  isSmallTeam: ownProps.isSmallTeam,
  minWriterRole: stateProps.minWriterRole,
  onSetNewRole: dispatchProps.onSetNewRole,
})

export default Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'MinWriterRole')(
  MinWriterRole
)
