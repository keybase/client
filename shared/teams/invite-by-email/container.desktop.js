// @flow
import * as TeamsGen from '../../actions/teams-gen'
import * as Constants from '../../constants/teams'
import InviteByEmailDesktop from '.'
import {navigateAppend} from '../../actions/route-tree'
import {connect, compose, withHandlers, withStateHandlers, type TypedState} from '../../util/container'
import {type OwnProps} from './container'

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => {
  const inviteError = Constants.getEmailInviteError(state)
  return {
    errorMessage: inviteError.message,
    malformedEmails: inviteError.malformed,
    name: routeProps.get('teamname'),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onClearInviteError: () => dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: ''})),
  onClose: () => dispatch(navigateUp()),
  onInvite: ({invitees, role}) => {
    dispatch(TeamsGen.createInviteToTeamByEmail({teamname: routeProps.get('teamname'), role, invitees}))
    dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: ''}))
    dispatch(TeamsGen.createGetTeams())
  },

  onOpenRolePicker: (role: string, onComplete: string => void) => {
    dispatch(
      navigateAppend([
        {
          props: {
            allowOwner: false,
            onComplete,
            selectedRole: role,
          },
          selected: 'controlledRolePicker',
        },
      ])
    )
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  compose(
    withHandlers({
      onInvite: ({onInvite, role}) => invitees => invitees && role && onInvite({invitees, role}),
    })
  )
)(InviteByEmailDesktop)
