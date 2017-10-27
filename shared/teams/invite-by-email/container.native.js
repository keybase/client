// @flow
import * as Creators from '../../actions/teams/creators'
import {Set, Map} from 'immutable'
import InviteByEmailMobile from '.'
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
    withPropsOnChange(['contacts'], props => {
      // Create static contact row props here
      const contactRowProps = props.contacts.reduce((res, contact) => {
        const contactName = isAndroid ? contact.givenName : contact.givenName + ' ' + contact.familyName
        contact.emailAddresses.forEach(email => {
          const cData = {
            name: contactName,
            email: email.email,
            label: email.label,
            thumbnailPath: contact.thumbnailPath,
            recordID: contact.recordID + email.email,
          }
          res.push({
            id: contact.recordID + email.email,
            loading: props.loadingInvites.get(email.email),
            contact: cData,
          })
        })
        contact.phoneNumbers.forEach(phoneNo => {
          const cData = {
            name: contactName,
            phoneNo: phoneNo.number,
            label: phoneNo.label,
            thumbnailPath: contact.thumbnailPath,
            recordID: contact.recordID + phoneNo.number,
          }
          res.push({
            id: contact.recordID + phoneNo.number,
            loading: props.loadingInvites.get(phoneNo.number),
            contact: cData,
          })
        })
        return res
      }, [])

      return {contactRowProps}
    }),
    withPropsOnChange(['contacts', '_pendingInvites'], props => {
      const invited = []

      // Search through pending invites & cross reference against contacts to find any who have been already invited
      // TODO: examine the perf implications of this.
      props._pendingInvites.toJS().forEach(invite => {
        props.contacts.forEach(contact => {
          contact.emailAddresses.forEach(address => {
            if (address.email === invite.email) {
              invited.push({contactID: contact.recordID + address.email, address: address.email})
            }
          })
          contact.phoneNumbers.forEach(phone => {
            if (phone.number === invite.name) {
              // TODO update invite prop once bookkeeping is piped through
              invited.push({contactID: contact.recordID + phone.number})
            }
          })
        })
      })

      return {invited}
    }),
    withHandlers({
      onInviteEmail: ({onInviteEmail, role}) => (invitee: string) => role && onInviteEmail({invitee, role}),
      onInvitePhone: ({onInvitePhone, role}) => (invitee: string) => role && onInvitePhone({invitee, role}),
      onUninvite: ({onUninvite}) => (invitee: string) => onUninvite(invitee),
    }),
    HeaderHoc
  )
)(InviteByEmailMobile)
