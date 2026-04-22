import * as C from '@/constants'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import type * as T from '@/constants/types'
import useContacts, {type Contact} from '../common/use-contacts.native'
import {InviteByContact, type ContactRowProps} from './index.native'
import {useTeamDetailsSubscribe} from '../subscriber'
import {getE164} from '@/util/phone-numbers'
import {openSMS} from '@/util/misc'
import logger from '@/logger'

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

const malformedEmailErrorMessage = (malformed: ReadonlyArray<string>) =>
  C.isMobile
    ? `Error parsing email: ${malformed[0]}`
    : `There was an error parsing ${malformed.length} address${malformed.length > 1 ? 'es' : ''}.`

const generateSMSBody = (teamname: string, seitan: string): string => {
  let team: string
  const teamOrSubteam = teamname.includes('.') ? 'subteam' : 'team'
  if (teamname.length <= 33) {
    team = `${teamname} ${teamOrSubteam}`
  } else {
    team = `..${teamname.substring(teamname.length - 30)} subteam`
  }
  return `Join the ${team} on Keybase. Copy this message into the "Teams" tab.\n\ntoken: ${seitan.toLowerCase()}\n\ninstall: keybase.io/_/go`
}

const TeamInviteByContact = (props: Props) => {
  const {teamID} = props
  const {contacts, region, errorMessage} = useContacts()
  const teamname = Teams.useTeamsState(s => Teams.getTeamMeta(s, teamID).teamname)
  const invites = Teams.useTeamsState(s => s.teamDetails.get(teamID) ?? Teams.emptyTeamDetails).invites

  useTeamDetailsSubscribe(teamID)

  const [selectedRole, setSelectedRole] = React.useState('writer' as T.Teams.TeamRoleType)
  const [inviteErrorMessage, setInviteErrorMessage] = React.useState('')
  const [loadingInvites, setLoadingInvites] = React.useState<Set<string>>(new Set())
  const inviteToTeamByEmail = C.useRPC(T.RPCGen.teamsTeamAddEmailsBulkRpcPromise)
  const inviteToTeamByPhone = C.useRPC(T.RPCGen.teamsTeamCreateSeitanTokenV2RpcPromise)
  const removePendingInvite = C.useRPC(T.RPCGen.teamsTeamRemoveMemberRpcPromise)

  const updateLoadingInvite = (loadingKey: string, isLoading: boolean) => {
    setLoadingInvites(prev => {
      const next = new Set(prev)
      if (isLoading) {
        next.add(loadingKey)
      } else {
        next.delete(loadingKey)
      }
      return next
    })
  }

  const onRoleChange = (role: T.Teams.TeamRoleType) => {
    setSelectedRole(role)
  }

  const onInviteContact = (contact: Contact) => {
    setInviteErrorMessage('')
    updateLoadingInvite(contact.value, true)
    switch (contact.type) {
      case 'email':
        inviteToTeamByEmail(
          [
            {
              emails: contact.value,
              name: teamname,
              role: T.RPCGen.TeamRole[selectedRole],
            },
            [C.waitingKeyTeamsTeam(teamID), C.waitingKeyTeamsAddToTeamByEmail(teamname)],
          ],
          res => {
            const malformed = res.malformed ?? []
            if (malformed.length > 0) {
              setInviteErrorMessage(malformedEmailErrorMessage(malformed))
            }
            updateLoadingInvite(contact.value, false)
          },
          error => {
            setInviteErrorMessage(error.desc)
            updateLoadingInvite(contact.value, false)
          }
        )
        break
      case 'phone':
        inviteToTeamByPhone(
          [
            {
              label: {
                sms: {
                  f: contact.name || '',
                  n: contact.valueFormatted || contact.value,
                } as T.RPCGen.SeitanKeyLabelSms,
                t: 1,
              },
              role: T.RPCGen.TeamRole[selectedRole],
              teamname,
            },
            C.waitingKeyTeamsTeam(teamID),
          ],
          seitan => {
            C.ignorePromise(
              (async () => {
                try {
                  await openSMS([contact.valueFormatted || contact.value], generateSMSBody(teamname, seitan))
                } catch (error) {
                  logger.info('Error sending SMS', error)
                  setInviteErrorMessage('Failed to open SMS composer.')
                } finally {
                  updateLoadingInvite(contact.value, false)
                }
              })()
            )
          },
          error => {
            setInviteErrorMessage(error.desc)
            updateLoadingInvite(contact.value, false)
          }
        )
        break
    }
  }

  const onCancelInvite = (inviteID: string) => {
    setInviteErrorMessage('')
    updateLoadingInvite(inviteID, true)
    removePendingInvite(
      [
        {
          member: {inviteid: {inviteID}, type: T.RPCGen.TeamMemberToRemoveType.inviteid},
          teamID,
        },
        [C.waitingKeyTeamsTeam(teamID), C.waitingKeyTeamsRemoveMember(teamID, inviteID)],
      ],
      () => {
        updateLoadingInvite(inviteID, false)
      },
      error => {
        setInviteErrorMessage(error.desc)
        updateLoadingInvite(inviteID, false)
      }
    )
  }

  // ----

  const teamAlreadyInvited = mapExistingInvitesToValues(invites, region)

  const listItems: Array<ContactRowProps> = contacts.map(contact => {
    // `id` is the key property for Kb.List
    const id = [contact.type, contact.value, contact.name].join('+')
    const inviteID = teamAlreadyInvited.get(contact.value)

    // `loadingKey` is inviteID when invite already (so loading is canceling the
    // invite), or contact.value when loading is adding an invite.
    const loadingKey = inviteID || contact.value
    const loading = loadingInvites.has(loadingKey)

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
      errorMessage={errorMessage || inviteErrorMessage}
      listItems={listItems}
      onRoleChange={onRoleChange}
      selectedRole={selectedRole}
      teamName={teamname}
    />
  )
}

export default TeamInviteByContact
