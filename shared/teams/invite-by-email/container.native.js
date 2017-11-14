// @flow
import * as Creators from '../../actions/teams/creators'
import {Set, Map} from 'immutable'
import InviteByEmailMobile, {type ContactDisplayProps} from '.'
import {HeaderHoc} from '../../common-adapters'
import {navigateAppend} from '../../actions/route-tree'
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
import {getContacts} from './permissions'

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => {
  const teamname = routeProps.get('teamname')
  return {
    name: teamname,
    _pendingInvites: teamname ? state.entities.getIn(['teams', 'teamNameToInvites', teamname], Set()) : Set(),
    loadingInvites: teamname
      ? state.entities.getIn(['teams', 'teamNameToLoadingInvites', teamname], Map())
      : Map(),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onInviteEmail: ({invitee, role}) => {
    dispatch(Creators.inviteToTeamByEmail(routeProps.get('teamname'), role, invitee))
    dispatch(Creators.getTeams())
  },
  onInvitePhone: ({invitee, role}) => {
    dispatch(Creators.inviteToTeamByPhone(routeProps.get('teamname'), role, invitee))
    dispatch(Creators.getTeams())
  },
  onUninvite: (invitee: string) => {
    dispatch(Creators.removeMember(invitee, routeProps.get('teamname'), ''))
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
    // basic state setters
    withState('role', 'onRoleChange', 'writer'),
    withPropsOnChange(['onExitSearch'], props => ({
      onBack: () => props.onClose(),
      title: 'Invite contacts',
      headerStyle: {borderBottomWidth: 0},
    })),
    withState('contacts', '_setContacts', []),
    withState('hasPermission', '_setHasPermission', true),
    // Go through the permission flow on mount
    lifecycle({
      componentWillMount() {
        // TODO test this permission flow on a real build
        getContacts().then(
          val => {
            this.props._setHasPermission(val.hasPermission)
            this.props._setContacts(val.contacts)
          },
          err => {
            console.warn('Error fetching contacts: ', err)
            this.props._setHasPermission(false)
          }
        )
      },
    }),
    // Checker for whether address is already in invited array
    withHandlers({
      isSelected: ({_pendingInvites}) => (addr: string): boolean => {
        return !!_pendingInvites.find(rec => rec.email === addr) // TODO search phone number
      },
    }),
    // Delegate to add / remove
    withHandlers({
      onSelectContact: ({isSelected, invited, role, onUninvite, onInviteEmail, onInvitePhone}) => (
        contact: ContactDisplayProps
      ) => {
        if (!isSelected(contact.email || contact.phoneNo)) {
          if (contact.email) {
            role && onInviteEmail({invitee: contact.email, role})
          } else if (contact.phoneNo) {
            role && onInvitePhone({invitee: contact.phoneNo, role})
          }
        } else {
          if (contact.email) {
            onUninvite(contact.email)
          } // TODO phone number uninvite
        }
      },
    }),
    // If contacts or _pendingInvites changes, recalculate the props on the contact rows.
    withPropsOnChange(['contacts', 'loadingInvites', '_pendingInvites'], props => {
      // Create static contact row props here
      const contactRowProps = props.contacts.reduce((res, contact) => {
        const contactName = isAndroid ? contact.givenName : contact.givenName + ' ' + contact.familyName
        contact.emailAddresses.concat(contact.phoneNumbers).forEach(addr => {
          const cData = {
            name: contactName,
            phoneNo: addr.number,
            email: addr.email,
            label: addr.label,
            thumbnailPath: contact.thumbnailPath,
            recordID: contact.recordID + (addr.email ? addr.email : addr.number),
          }
          res.push({
            id: contact.recordID + (addr.email ? addr.email : addr.number),
            loading: props.loadingInvites.get(addr.email),
            contact: cData,
            selected: props.isSelected(cData.email || cData.phoneNo),
            onClick: () => props.onSelectContact(cData),
          })
        })
        return res
      }, [])

      return {contactRowProps}
    }),
    HeaderHoc
  )
)(InviteByEmailMobile)
