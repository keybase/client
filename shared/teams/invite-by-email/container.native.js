// @flow
import logger from '../../logger'
import * as ConfigGen from '../../actions/config-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as Constants from '../../constants/teams'
import * as I from 'immutable'
import {InviteByEmailMobile, type ContactDisplayProps} from '.'
import {HeaderHoc} from '../../common-adapters'
import {
  connect,
  compose,
  withHandlers,
  withPropsOnChange,
  withProps,
  withStateHandlers,
  lifecycle,
  type RouteProps,
} from '../../util/container'
import {isAndroid} from '../../constants/platform'
import {getContacts} from './permissions'

type OwnProps = RouteProps<{teamname: string}, {}>

const cleanPhoneNumber: string => string = (dirty: string) => {
  return dirty.replace(/\D/g, '')
}

// we get invite name as `[name] ([phone number]), this extracts [phone number]
const extractPhoneNumber: string => ?string = (name: string) => {
  const matches = /\((.*)\)/.exec(name)
  return (matches && matches[1] && cleanPhoneNumber(matches[1])) || ''
}

const mapStateToProps = (state, {routeProps}: OwnProps) => {
  const teamname = routeProps.get('teamname')
  const inviteError = Constants.getEmailInviteError(state)
  return {
    _pendingInvites: teamname ? Constants.getTeamInvites(state, teamname) : I.Set(),
    errorMessage: inviteError.message,
    loadingInvites: teamname ? Constants.getTeamLoadingInvites(state, teamname) : I.Map(),
    name: teamname,
  }
}

const mapDispatchToProps = (dispatch, {navigateAppend, navigateUp, routePath, routeProps}) => ({
  onClearError: () => dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: ''})),
  onClose: () => {
    dispatch(navigateUp())
    dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: ''}))
  },
  onInviteEmail: ({invitee, role}) => {
    const teamname = routeProps.get('teamname')
    const rootPath = routePath.take(1)
    const sourceSubPath = routePath.rest()
    const destSubPath = sourceSubPath.butLast()
    dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: ''}))
    dispatch(
      TeamsGen.createInviteToTeamByEmail({
        destSubPath,
        invitees: invitee,
        role,
        rootPath,
        sourceSubPath,
        teamname,
      })
    )
    dispatch(TeamsGen.createGetTeams())
  },
  onInvitePhone: ({invitee, role, fullName = ''}) => {
    dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: ''}))
    dispatch(
      TeamsGen.createInviteToTeamByPhone({
        fullName,
        phoneNumber: invitee,
        role,
        teamname: routeProps.get('teamname'),
      })
    )
    dispatch(TeamsGen.createGetTeams())
  },
  onOpenRolePicker: (role: string, onComplete: string => void) => {
    dispatch(
      navigateAppend([
        {
          props: {
            allowAdmin: false,
            allowOwner: false,
            onComplete,
            selectedRole: role,
          },
          selected: 'controlledRolePicker',
        },
      ])
    )
  },
  onUninvite: (invitee: string, id?: string) => {
    dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: ''}))
    dispatch(
      TeamsGen.createRemoveMemberOrPendingInvite({
        email: invitee,
        inviteID: id || '',
        teamname: routeProps.get('teamname'),
        username: '',
      })
    )
  },

  openAppSettings: () => dispatch(ConfigGen.createOpenAppSettings()),
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  compose(
    // basic state setters
    withStateHandlers(
      {contacts: [], hasPermission: true, role: 'writer'},
      {
        _setContacts: () => contacts => ({contacts}),
        _setHasPermission: () => hasPermission => ({hasPermission}),
        onRoleChange: () => role => ({role}),
      }
    ),
    withProps(props => ({
      headerStyle: {borderBottomWidth: 0},
      onBack: () => props.onClose(),
      title: 'Invite contacts',
    })),
    // Go through the permission flow on mount
    lifecycle({
      componentDidMount() {
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
            role && onInvitePhone({fullName: contact.name, invitee: contact.phoneNo, role})
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
      const knownIDs = new Set()
      const contactRowProps = props.contacts
        .reduce((res, contact) => {
          const contactName = isAndroid ? contact.givenName : contact.givenName + ' ' + contact.familyName
          contact.emailAddresses.concat(contact.phoneNumbers).forEach(addr => {
            const cData = {
              email: addr.email,
              label: addr.label,
              name: contactName,
              phoneNo: addr.number,
              recordID: contact.recordID + (addr.email ? addr.email : addr.number),
              thumbnailPath: contact.thumbnailPath,
            }

            const id = contact.recordID + (addr.email ? addr.email : addr.number)
            if (!knownIDs.has(id)) {
              knownIDs.add(id)
              res.push({
                contact: cData,
                id,
                loading: props.isLoading(addr.email, addr.number),
                onClick: () => props.onSelectContact(cData),
                selected: props.isSelected(cData.email || cData.phoneNo, cData.name),
              })
            }
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
    HeaderHoc
  )
)(InviteByEmailMobile)
