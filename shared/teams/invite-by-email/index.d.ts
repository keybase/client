import * as React from 'react'
import * as I from 'immutable'
import {TeamRoleType} from '../../constants/types/teams'

// Note: 'on Android the entire display name is passed in the givenName field. middleName and familyName will be empty strings.'
export type ContactProps = {
  recordID: string
  company: string
  emailAddresses: Array<{
    label: string
    email: string
  }>
  familyName: string
  givenName: string
  middleName: string
  phoneNumbers: Array<{
    label: string
    number: string
  }>
  hasThumbnail: boolean
  thumbnailPath: string
}

export type ContactDisplayProps = {
  name: string
  email?: string
  phoneNo?: string
  thumbnailPath?: string
  label: string
  recordID: string
}

export type ContactRowProps = {
  contact: ContactDisplayProps
  id: string
  loading?: boolean
  onClick?: () => void
  selected?: boolean
}

export type DesktopProps = {
  errorMessage: string
  malformedEmails: I.Set<string>
  name: string
  onClearInviteError: () => void
  onClose: () => void
  onInvite: (invitees: string, role: TeamRoleType) => void
  waitingKey: string
}

export type MobileProps = {
  errorMessage: string
  invitee: string
  invited: Array<{
    contactID: string
    address?: string
  }>
  loadingInvites: any
  name: string
  openAppSettings: () => void
  onClearError: () => void
  onClose: () => void
  onInviteEmail: (invitee: string) => void
  onInvitePhone: (invitee: string) => void
  onUninvite: (invitee: string) => void
  onRoleChange: (role: TeamRoleType) => void
  addInvitee: (contact: ContactDisplayProps) => void
  removeInvitee: (contact: ContactDisplayProps) => void
  role: TeamRoleType
  contacts: Array<ContactProps>
  contactRowProps: Array<ContactRowProps>
  hasPermission: boolean
}

export declare class InviteByEmailDesktop extends React.Component<DesktopProps> {}
export declare class InviteByEmailMobile extends React.Component<MobileProps> {}
