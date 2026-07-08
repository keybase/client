// Desktop stub — inviting teammates by phone contact is mobile-only. This module is
// imported by team-invite-by-contacts.tsx (a lazy route) but only rendered on mobile,
// so a no-op component + permissive row type is sufficient on desktop.
import type * as T from '@/constants/types'

export type ContactRowProps = {[key: string]: unknown}

type InviteByContactProps = {
  selectedRole: T.Teams.TeamRoleType
  onRoleChange: (newRole: T.Teams.TeamRoleType) => void
  teamName: string
  listItems: Array<ContactRowProps>
  errorMessage?: string
}

export const InviteByContact = (_props: InviteByContactProps): null => null
