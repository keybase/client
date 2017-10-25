// @flow
import * as Creators from '../../actions/teams/creators'
import {Set} from 'immutable'
import InviteByEmail from '.'
import {HeaderHoc} from '../../common-adapters'
import {navigateAppend} from '../../actions/route-tree'
import * as Contacts from 'react-native-contacts'
import {
  connect,
  compose,
  withHandlers,
  withPropsOnChange,
  withState,
  lifecycle,
  type TypedState,
} from '../../util/container'
import {isMobile, isAndroid} from '../../constants/platform'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  name: routeProps.get('teamname'),
  _invites: state.entities.getIn(['teams', 'teamNameToInvites', routeProps.get('teamname')], Set()),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onInvite: ({invitees, role}) => {
    dispatch(Creators.inviteToTeamByEmail(routeProps.get('teamname'), role, invitees))
    if (!isMobile) {
      dispatch(navigateUp())
    }
    dispatch(Creators.getTeams())
  },

  onOpenRolePicker: (role: string, onComplete: string => void) => {
    dispatch(
      navigateAppend([
        {
          props: {
            allowOwner: false,
            allowAdmin: false,
            onComplete,
            selectedRole: role,
          },
          selected: 'controlledRolePicker',
        },
      ])
    )
  },
})

const desktopInviteByEmail = compose(
  connect(mapStateToProps, mapDispatchToProps),
  compose(
    withState('invitees', 'onInviteesChange'),
    withState('role', 'onRoleChange', 'writer'),
    withPropsOnChange(['onExitSearch'], props => ({
      onCancel: () => props.onClose(),
      title: 'Invite by email',
    })),
    withHandlers({
      onInvite: ({invitees, onInvite, role}) => () => invitees && role && onInvite({invitees, role}),
    }),
    HeaderHoc
  )
)(InviteByEmail)

const mobileInviteByEmail = compose(
  connect(mapStateToProps, mapDispatchToProps),
  compose(
    withState('role', 'onRoleChange', 'writer'),
    withPropsOnChange(['onExitSearch'], props => ({
      onBack: () => props.onClose(),
      title: 'Invite contacts',
      headerStyle: {borderBottomWidth: 0},
    })),
    withState('contacts', '_setContacts', []),
    withState('hasPermission', '_setHasPermission', true),
    lifecycle({
      componentWillMount() {
        // TODO test this permission flow on a real build
        if (isAndroid) {
          Contacts.requestPermission((_, granted) => {
            this.props._setHasPermission(false)
            if (granted) {
              Contacts.getAll((err, contacts) => {
                if (err) {
                  this.props._setHasPermission(false)
                } else {
                  this.props._setHasPermission(true)
                  this.props._setContacts(contacts)
                }
              })
            }
          })
        } else {
          Contacts.getAll((err, contacts) => {
            if (err) {
              this.props._setHasPermission(false)
            } else {
              this.props._setHasPermission(true)
              this.props._setContacts(contacts)
            }
          })
        }
      },
    }),
    withHandlers({
      onInvite: ({onInvite, role}) => (invitee: string) => role && onInvite({invitees: invitee, role}),
    }),
    HeaderHoc
  )
)(InviteByEmail)

export default (isMobile ? mobileInviteByEmail : desktopInviteByEmail)
