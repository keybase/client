import * as Constants from '../../constants/teams'
import * as Container from '../../util/container'
import * as React from 'react'
import * as SettingsConstants from '../../constants/settings'
import * as TeamsGen from '../../actions/teams-gen'
import {TeamRoleType} from '../../constants/types/teams'

import {ContactProps, ContactRowProps, InviteByContact} from './index.native'

// Seitan invite names (labels) look like this: "[name] ([phone number])". Try
// to derive E164 phone number based on seitan invite name and user's region.
const extractPhoneNumber = (name: string, region: string): string | null => {
  const matches = /\((.*)\)/.exec(name)
  const maybeNumber = matches && matches[1] && matches[1].replace(/[^0-9+]/g, '')
  return maybeNumber ? SettingsConstants.getE164(maybeNumber, region) : null
}

// Extract either emails or phone numbers from team invites, to match to
// contacts and show whether the contact is invited already or not. Returns a
// mapping of potential contact values to invite IDs.
const mapExistingInvitesToValues = (
  invites: ReturnType<typeof Constants.getTeamInvites>,
  region: string
): Map<string, string> => {
  const ret = new Map<string, string>()
  invites.forEach(invite => {
    if (invite.email) {
      // Email invite - just use email as the key.
      ret.set(invite.email, invite.id)
    } else if (invite.name) {
      // Seitan invite. Extract phone number from invite name and use as the
      // key. The extracted phone number will be full E164.
      const val = extractPhoneNumber(invite.name, region)
      if (val) {
        ret.set(val, invite.id)
      }
    }
  })
  return ret
}

type TeamInviteByContactProps = {
  teamname: string
  contacts: Array<ContactProps>
  region: string
  errorMessage: string | null
}

const TeamInviteByContact = (props: TeamInviteByContactProps) => {
  const {teamname, contacts, region, errorMessage} = props

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const [selectedRole, setSelectedRole] = React.useState('writer' as TeamRoleType)

  const teamInvites = Container.useSelector(s => Constants.getTeamInvites(s, teamname))
  const loadingInvites = Container.useSelector(s => Constants.getTeamLoadingInvites(s, teamname))

  const onBack = React.useCallback(() => {
    dispatch(nav.safeNavigateUpPayload())
    dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: ''}))
  }, [dispatch, nav])

  const onRoleChange = React.useCallback(
    (role: TeamRoleType) => {
      setSelectedRole(role)
    },
    [setSelectedRole]
  )

  const onInviteContact = React.useCallback(
    (contact: ContactProps) => {
      dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: ''}))
      if (contact.type === 'email') {
        dispatch(
          TeamsGen.createInviteToTeamByEmail({
            invitees: contact.value,
            loadingKey: contact.value,
            role: selectedRole,
            teamname,
          })
        )
      } else if (contact.type === 'phone') {
        dispatch(
          TeamsGen.createInviteToTeamByPhone({
            fullName: contact.name,
            loadingKey: contact.value,
            phoneNumber: contact.valueFormatted || contact.value,
            role: selectedRole,
            teamname,
          })
        )
      }
      dispatch(TeamsGen.createGetTeams())
    },
    [dispatch, selectedRole, teamname]
  )

  const onCancelInvite = React.useCallback(
    (inviteID: string) => {
      dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: ''}))
      dispatch(
        TeamsGen.createRemoveMemberOrPendingInvite({
          email: '',
          inviteID,
          loadingKey: inviteID,
          teamname,
          username: '',
        })
      )
    },
    [dispatch, teamname]
  )

  // ----

  const teamAlreadyInvited = mapExistingInvitesToValues(teamInvites, region)

  let listItems: Array<ContactRowProps> = contacts.map(contact => {
    // `id` is the key property for Kb.List
    const id = [contact.type, contact.value, contact.name].join('+')
    const inviteID = teamAlreadyInvited.get(contact.value)

    // `loadingKey` is inviteID when invite already (so loading is canceling the
    // invite), or contact.value when loading is adding an invite.
    const loadingKey = inviteID || contact.value
    const loading = loadingInvites.get(loadingKey, false)

    const onClick = inviteID ? () => onCancelInvite(inviteID) : () => onInviteContact(contact)

    return {
      ...contact,
      alreadyInvited: !!inviteID,
      id,
      loading,
      onClick,
    }
  })

  return (
    <InviteByContact
      errorMessage={errorMessage}
      listItems={listItems}
      onBack={onBack}
      onRoleChange={onRoleChange}
      selectedRole={selectedRole}
      teamName={teamname}
    />
  )
}

export default TeamInviteByContact
