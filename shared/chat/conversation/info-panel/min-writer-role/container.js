// @flow
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Types from '../../../../constants/types/chat2'
import * as TeamTypes from '../../../../constants/types/teams'
import MinWriterRole from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const meta = Constants.getMeta(state, ownProps.conversationIDKey)
  return {
    canSetMinWriterRole: true,
    minWriterRole: meta.minWriterRole,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onSetNewRole: (role: TeamTypes.TeamRoleType) =>
    dispatch(Chat2Gen.createSetMinWriterRole({conversationIDKey: ownProps.conversationIDKey, role})),
})

export default Container.connect(mapStateToProps, mapDispatchToProps)(MinWriterRole)
