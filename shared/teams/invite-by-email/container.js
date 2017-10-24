// @flow
import * as Creators from '../../actions/teams/creators'
import InviteByEmail from '.'
import {HeaderHoc} from '../../common-adapters'
import {navigateAppend} from '../../actions/route-tree'
import {
  connect,
  compose,
  withHandlers,
  withPropsOnChange,
  withState,
  type TypedState,
} from '../../util/container'
import {isMobile} from '../../constants/platform'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  name: routeProps.get('teamname'),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onInvite: ({invitees, role}) => {
    dispatch(Creators.inviteToTeamByEmail(routeProps.get('teamname'), role, invitees))
    dispatch(navigateUp())
    dispatch(Creators.getTeams())
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
    withState('invitees', 'onInviteesChange'),
    withState('role', 'onRoleChange', 'writer'),
    withPropsOnChange(['onExitSearch'], props => ({
      onCancel: isMobile ? undefined : () => props.onClose(),
      onBack: isMobile ? () => props.onClose() : undefined,
      title: isMobile ? 'Invite contacts' : 'Invite by email',
      headerStyle: isMobile ? {borderBottomWidth: 0} : {},
    })),
    withHandlers({
      onInvite: ({invitees, onInvite, role}) => () => invitees && role && onInvite({invitees, role}),
    }),
    HeaderHoc
  )
)(InviteByEmail)
