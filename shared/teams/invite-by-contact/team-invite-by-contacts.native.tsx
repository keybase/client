import * as React from 'react'
import * as Teams from '@/stores/teams'
import type * as T from '@/constants/types'
import useContacts, {type Contact} from '../common/use-contacts.native'
import {InviteByContact, type ContactRowProps} from './index.native'
import {useTeamDetailsSubscribe} from '../subscriber'
import {useSafeNavigation} from '@/util/safe-navigation'
import {getE164} from '@/util/phone-numbers'

// Seitan invite names (labels) look like this: "[name] ([phone number])". Try
// to derive E164 phone number based on seitan invite name and user's region.
const extractPhoneNumber = (name: string, region: string): string => {
  const matches = /\((.*)\)/.exec(name)
  const maybeNumber = matches?.[1]?.replace(/[^0-9+]/g, '')
  return (maybeNumber && getE164(maybeNumber, region)) ?? ''
}

// Extract either emails or phone numbers from team invites, to match to
// contacts and show whether the contact is invited already or not. Returns a
// mapping of potential contact values to invite IDs.
const mapExistingInvitesToValues = (
  invites: T.Teams.TeamDetails['invites'],
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

type Props = {
  teamID: T.Teams.TeamID
}

const TeamInviteByContact = (props: Props) => {
  const {teamID} = props
  const {contacts, region, errorMessage} = useContacts()
  const teamname = Teams.useTeamsState(s => Teams.getTeamMeta(s, teamID).teamname)
  const invites = Teams.useTeamsState(s => s.teamDetails.get(teamID) ?? Teams.emptyTeamDetails).invites

  useTeamDetailsSubscribe(teamID)

  const nav = useSafeNavigation()

  const [selectedRole, setSelectedRole] = React.useState('writer' as T.Teams.TeamRoleType)

  const loadingInvites = Teams.useTeamsState(s => s.teamNameToLoadingInvites.get(teamname))
  const resetErrorInEmailInvite = Teams.useTeamsState(s => s.dispatch.resetErrorInEmailInvite)
  const onBack = React.useCallback(() => {
    nav.safeNavigateUp()
    resetErrorInEmailInvite()
  }, [resetErrorInEmailInvite, nav])

  const onRoleChange = React.useCallback(
    (role: T.Teams.TeamRoleType) => {
      setSelectedRole(role)
    },
    [setSelectedRole]
  )
  const inviteToTeamByEmail = Teams.useTeamsState(s => s.dispatch.inviteToTeamByEmail)
  const inviteToTeamByPhone = Teams.useTeamsState(s => s.dispatch.inviteToTeamByPhone)

  const onInviteContact = React.useCallback(
    (contact: Contact) => {
      resetErrorInEmailInvite()
      switch (contact.type) {
        case 'email':
          inviteToTeamByEmail(contact.value, selectedRole, teamID, teamname, contact.value)
          break
        case 'phone':
          inviteToTeamByPhone(
            teamID,
            teamname,
            selectedRole,
            contact.valueFormatted || contact.value,
            contact.name,
            contact.value
          )
          break
      }
    },
    [inviteToTeamByPhone, inviteToTeamByEmail, resetErrorInEmailInvite, selectedRole, teamID, teamname]
  )

  const removePendingInvite = Teams.useTeamsState(s => s.dispatch.removePendingInvite)
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
