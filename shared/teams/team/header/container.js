// @flow
import {connect, type TypedState} from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import {createAddResultsToUserInput} from '../../../actions/search-gen'
import {createOpenTeamConversation} from '../../../actions/chat-gen'
import {navigateAppend} from '../../../actions/route-tree'
import {TeamHeader} from '.'

export type OwnProps = {
  teamname: Types.Teamname,
}

const mapStateToProps = (state: TypedState, {teamname}: OwnProps) => {
  const yourOperations = Constants.getCanPerform(state, teamname)
  return {
    canEditDescription: yourOperations.editChannelDescription,
    canJoinTeam: yourOperations.joinTeam,
    canManageMembers: yourOperations.manageMembers,
    description: state.entities.getIn(['teams', 'teamNameToPublicitySettings', teamname, 'description'], ''),
    memberCount: state.entities.getIn(['teams', 'teammembercounts', teamname], 0),
    openTeam: state.entities.getIn(['teams', 'teamNameToTeamSettings', teamname, 'open'], false),
    role: Constants.getRole(state, teamname),
    you: state.config.username,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {teamname}: OwnProps) => ({
  _onAddSelf: (you: ?string) => {
    if (!you) {
      return
    }
    dispatch(navigateAppend([{props: {teamname}, selected: 'addPeople'}]))
    dispatch(createAddResultsToUserInput({searchKey: 'addToTeamSearch', searchResults: [you]}))
  },
  onAddPeople: target =>
    dispatch(
      navigateAppend([
        {
          props: {teamname, position: 'bottom left', targetRect: target && target.getBoundingClientRect()},
          selected: 'addPeopleHow',
        },
      ])
    ),
  onChat: () => dispatch(createOpenTeamConversation({teamname, channelname: 'general'})),
  onEditDescription: () => dispatch(navigateAppend([{props: {teamname}, selected: 'editTeamDescription'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
  onAddSelf: () => dispatchProps._onAddSelf(stateProps.you),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamHeader)
