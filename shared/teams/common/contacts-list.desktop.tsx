// Desktop stub — contact invites are mobile-only (add-contacts renders these only in
// an isMobile branch). No-op components/hook so the import resolves on desktop.
import type * as React from 'react'
import type {Contact} from './use-contacts.native'

type ContactsListProps = {
  onSelect: (contact: Contact, checked: boolean) => void
  search: string
  selectedEmails: Set<string>
  selectedPhones: Set<string>
}

const ContactsList: React.ComponentType<ContactsListProps> = () => null
export default ContactsList

export const useContacts = (): {contacts: Array<Contact>; loading: boolean; noAccessPermanent: boolean} => ({
  contacts: [],
  loading: false,
  noAccessPermanent: false,
})

export const EnableContactsPopup: React.ComponentType<{noAccess: boolean; onClose: () => void}> = () => null
