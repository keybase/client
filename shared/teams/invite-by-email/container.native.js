// @flow
import * as Creators from '../../actions/teams/creators'
import {Set} from 'immutable'
import InviteByEmailMobile from '.'
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
import {type OwnProps} from './container'
import {isAndroid} from '../../constants/platform'

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => ({
  name: routeProps.get('teamname'),
  _pendingInvites: state.entities.getIn(
    ['teams', 'teamNameToInvites', routeProps.get('teamname') || ''],
    Set()
  ),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onInvite: ({invitee, role}) => {
    dispatch(Creators.inviteToTeamByEmail(routeProps.get('teamname'), role, invitee))
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

export default compose(
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
    withPropsOnChange(['contacts', '_pendingInvites'], props => {
      const invitees = []

      // Search through pending invites & cross reference against contacts to find any who have been already invited
      // TODO: examine the perf implications of this.
      props._pendingInvites.toJS().forEach(invite => {
        props.contacts.forEach(contact => {
          contact.emailAddresses.forEach(address => {
            if (address.email === invite.name) {
              invitees.push({contactID: contact.recordID + address.email, address: address.email})
            }
          })
          contact.phoneNumbers.forEach(phone => {
            if (phone.number === invite.name) {
              invitees.push({contactID: contact.recordID + phone.number})
            }
          })
        })
      })

      return {invitees}
    }),
    withHandlers({
      onInvite: ({onInvite, role}) => (invitee: string) => role && onInvite({invitee, role}),
    }),
    HeaderHoc
  )
)(InviteByEmailMobile)
