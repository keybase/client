// @flow
import logger from '../../logger'
import * as TeamsGen from '../../actions/teams-gen'
import {Set, Map} from 'immutable'
import InviteByEmailMobile, {type ContactDisplayProps} from '.'
import {HeaderHoc} from '../../common-adapters'
import {navigateAppend} from '../../actions/route-tree'
import {
  connect,
  compose,
  withHandlers,
  withPropsOnChange,
  withStateHandlers,
  lifecycle,
  type TypedState,
} from '../../util/container'
import {type OwnProps} from './container'
import {isAndroid} from '../../constants/platform'
import {getContacts} from './permissions'

const cleanPhoneNumber: string => string = (dirty: string) => {
  return dirty.replace(/\D/g, '')
}

// we get invite name as `[name] ([phone number]), this extracts [phone number]
const extractPhoneNumber: string => ?string = (name: string) => {
  const matches = /\((.*)\)/.exec(name)
  return (matches && matches[1] && cleanPhoneNumber(matches[1])) || ''
}

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
    dispatch(
      TeamsGen.createInviteToTeamByEmail({teamname: routeProps.get('teamname'), role, invitees: invitee})
    )
    dispatch(TeamsGen.createGetTeams())
  },
  onInvitePhone: ({invitee, role, fullName = ''}) => {
    dispatch(
      TeamsGen.createInviteToTeamByPhone({
        teamname: routeProps.get('teamname'),
        role,
        phoneNumber: invitee,
        fullName,
      })
    )
    dispatch(TeamsGen.createGetTeams())
  },
  onUninvite: (invitee: string, id?: string) => {
    dispatch(
      TeamsGen.createRemoveMemberOrPendingInvite({
        email: invitee,
        teamname: routeProps.get('teamname'),
        username: '',
        inviteID: id || '',
      })
    )
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
    withStateHandlers(
      {role: 'writer', contacts: [], hasPermission: true},
      {
        onRoleChange: () => role => ({role}),
        _setContacts: () => contacts => ({contacts}),
        _setHasPermission: () => hasPermission => ({hasPermission}),
      }
    ),
    withPropsOnChange(['onExitSearch'], props => ({
      onBack: () => props.onClose(),
      title: 'Invite contacts',
      headerStyle: {borderBottomWidth: 0},
    })),
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
            logger.warn('Error fetching contacts: ', err)
            this.props._setHasPermission(false)
          }
        )
      },
    }),
    // Checker for whether address is already in invited array
    withHandlers({
      isSelected: ({_pendingInvites}) => (addr: string, name?: string): boolean => {
        return !!_pendingInvites.find(rec => {
          if (rec.email) {
            return rec.email === addr
          } else if (rec.name) {
            const recPhoneNumber = extractPhoneNumber(rec.name)
            if (recPhoneNumber) {
              // Check bare numbers against one another
              return recPhoneNumber === cleanPhoneNumber(addr)
            }
          }
          return false
        })
      },
      isLoading: ({loadingInvites, _pendingInvites}) => (email: ?string, phoneNo: ?string): boolean => {
        if (email) {
          return loadingInvites.get(email)
        }
        const relevantInvite = _pendingInvites.find(rec => {
          if (rec.name) {
            const recPhoneNumber = extractPhoneNumber(rec.name)
            if (recPhoneNumber) {
              // Check bare numbers against one another
              return recPhoneNumber === cleanPhoneNumber(phoneNo || '')
            }
          }
        })
        if (relevantInvite) {
          return loadingInvites.get(relevantInvite.id)
        }
        return false
      },
    }),
    // Delegate to add / remove
    withHandlers({
      onSelectContact: ({
        _pendingInvites,
        isSelected,
        invited,
        role,
        onUninvite,
        onInviteEmail,
        onInvitePhone,
      }) => (contact: ContactDisplayProps) => {
        if (!isSelected(contact.email || contact.phoneNo)) {
          if (contact.email) {
            role && onInviteEmail({invitee: contact.email, role})
          } else if (contact.phoneNo) {
            role && onInvitePhone({invitee: contact.phoneNo, role, fullName: contact.name})
          }
        } else {
          if (contact.email) {
            onUninvite(contact.email)
          } else if (contact.phoneNo) {
            const relevantInvite = _pendingInvites.find(rec => {
              if (rec.name) {
                const recPhoneNumber = extractPhoneNumber(rec.name)
                if (recPhoneNumber) {
                  // Check bare numbers against one another
                  return recPhoneNumber === cleanPhoneNumber(contact.phoneNo || '')
                }
              }
            })
            if (relevantInvite) {
              onUninvite('', relevantInvite.id)
            } else {
              logger.warn('Could not find invite to remove in pending invites')
            }
          }
        }
      },
    }),
    // If contacts or _pendingInvites changes, recalculate the props on the contact rows.
    withPropsOnChange(['contacts', 'loadingInvites', '_pendingInvites'], props => {
      // Create static contact row props here
      const contactRowProps = props.contacts
        .reduce((res, contact) => {
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
              loading: props.isLoading(addr.email, addr.number),
              contact: cData,
              selected: props.isSelected(cData.email || cData.phoneNo, cData.name),
              onClick: () => props.onSelectContact(cData),
            })
          })
          return res
        }, [])
        .sort((a, b) => {
          const ca = a.contact
          const cb = b.contact

          if (ca.name === cb.name) {
            return (ca.email || ca.phoneNo || '').localeCompare(cb.email || cb.phoneNo || '')
          }
          return (ca.name || '').localeCompare(cb.name || '')
        })

      return {contactRowProps}
    }),
    // $FlowIssue doesn't like withProps
    HeaderHoc
  )
)(InviteByEmailMobile)
