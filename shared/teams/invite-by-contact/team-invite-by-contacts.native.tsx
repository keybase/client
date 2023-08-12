import * as C from '../../constants'
import * as Constants from '../../constants/teams'
import * as Container from '../../util/container'
import * as React from 'react'
import type * as Types from '../../constants/types/teams'
import useContacts, {type Contact} from '../common/use-contacts.native'
import {InviteByContact, type ContactRowProps} from './index.native'
import {useTeamDetailsSubscribe} from '../subscriber'

// Seitan invite names (labels) look like this: "[name] ([phone number])". Try
// to derive E164 phone number based on seitan invite name and user's region.
const extractPhoneNumber = (name: string, region: string): string => {
  const matches = /\((.*)\)/.exec(name)
  const maybeNumber = matches?.[1]?.replace(/[^0-9+]/g, '')
  return (maybeNumber && C.getE164(maybeNumber, region)) ?? ''
}

// Extract either emails or phone numbers from team invites, to match to
// contacts and show whether the contact is invited already or not. Returns a
// mapping of potential contact values to invite IDs.
const mapExistingInvitesToValues = (
  invites: Types.TeamDetails['invites'],
  region: string
): Map<string, string> => {
  const ret = new Map<string, string>()
  invites?.forEach(invite => {
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

type Props = {
  teamID: Types.TeamID
}

const TeamInviteByContact = (props: Props) => {
  const {teamID} = props
  const {contacts, region, errorMessage} = useContacts()
  const teamname = C.useTeamsState(s => Constants.getTeamMeta(s, teamID).teamname)
  const invites = C.useTeamsState(s => s.teamDetails.get(teamID) ?? Constants.emptyTeamDetails).invites

  useTeamDetailsSubscribe(teamID)

  const nav = Container.useSafeNavigation()

  const [selectedRole, setSelectedRole] = React.useState('writer' as Types.TeamRoleType)

  const loadingInvites = C.useTeamsState(s => s.teamNameToLoadingInvites.get(teamname))
  const resetErrorInEmailInvite = C.useTeamsState(s => s.dispatch.resetErrorInEmailInvite)
  const onBack = React.useCallback(() => {
    nav.safeNavigateUp()
    resetErrorInEmailInvite()
  }, [resetErrorInEmailInvite, nav])

  const onRoleChange = React.useCallback(
    (role: Types.TeamRoleType) => {
      setSelectedRole(role)
    },
    [setSelectedRole]
  )
  const inviteToTeamByEmail = C.useTeamsState(s => s.dispatch.inviteToTeamByEmail)
  const inviteToTeamByPhone = C.useTeamsState(s => s.dispatch.inviteToTeamByPhone)

  const onInviteContact = React.useCallback(
    (contact: Contact) => {
      resetErrorInEmailInvite()
      if (contact.type === 'email') {
        inviteToTeamByEmail(contact.value, selectedRole, teamID, teamname, contact.value)
      } else if (contact.type === 'phone') {
        inviteToTeamByPhone(
          teamID,
          teamname,
          selectedRole,
          contact.valueFormatted || contact.value,
          contact.name,
          contact.value
        )
      }
    },
    [inviteToTeamByPhone, inviteToTeamByEmail, resetErrorInEmailInvite, selectedRole, teamID, teamname]
  )

  const removePendingInvite = C.useTeamsState(s => s.dispatch.removePendingInvite)
  const onCancelInvite = React.useCallback(
    (inviteID: string) => {
      resetErrorInEmailInvite()
      removePendingInvite(teamID, inviteID)
    },
    [resetErrorInEmailInvite, removePendingInvite, teamID]
  )

  // ----

  const teamAlreadyInvited = mapExistingInvitesToValues(invites, region)

  const listItems: Array<ContactRowProps> = contacts.map(contact => {
    // `id` is the key property for Kb.List
    const id = [contact.type, contact.value, contact.name].join('+')
    const inviteID = teamAlreadyInvited.get(contact.value)

    // `loadingKey` is inviteID when invite already (so loading is canceling the
    // invite), or contact.value when loading is adding an invite.
    const loadingKey = inviteID || contact.value
    const loading = loadingInvites?.get(loadingKey) ?? false

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
