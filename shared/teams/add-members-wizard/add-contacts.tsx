import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {pluralize} from '@/util/string'
import {addMembersToWizardAndNav, searchResultsToMembers, type AddMembersWizard} from './state'
import type {Contact} from '../common/use-contacts.native'
// contacts-list.native resolves to a desktop stub on desktop (contacts-list.desktop),
// used only in the isMobile branch below.
import ContactsList, {useContacts, EnableContactsPopup} from '../common/contacts-list.native'

const AddContactsMobile = ({wizard}: {wizard: AddMembersWizard}) => {
  const onBack = C.Router2.navigateUp
  const [search, setSearch] = React.useState('')
  const [selectedPhones, setSelectedPhones] = React.useState(new Set<string>())
  const [selectedEmails, setSelectedEmails] = React.useState(new Set<string>())
  const [error, setError] = React.useState('')
  const {contacts, loading, noAccessPermanent} = useContacts()
  const placeholderText = loading ? '' : `Search ${contacts.length} ${pluralize('contact', contacts.length)}`

  const onSelectContact = (contact: Contact, checked: boolean) => {
    if (contact.type === 'phone') {
      if (checked) {
        selectedPhones.add(contact.value)
      } else {
        selectedPhones.delete(contact.value)
      }
      setSelectedPhones(new Set(selectedPhones))
    } else {
      if (checked) {
        selectedEmails.add(contact.value)
      } else {
        selectedEmails.delete(contact.value)
      }
      setSelectedEmails(new Set(selectedEmails))
    }
  }

  const [waiting, setWaiting] = React.useState(false)
  const toAssertionsRPC = C.useRPC(T.RPCGen.userSearchBulkEmailOrPhoneSearchRpcPromise)

  const noneSelected = selectedPhones.size + selectedEmails.size === 0

  const onDone = () => {
    if (waiting) {
      return
    }
    setError('')
    setWaiting(true)
    toAssertionsRPC(
      [{emails: [...selectedEmails].join(','), phoneNumbers: [...selectedPhones]}],
      r => {
        if (r?.length) {
          C.ignorePromise(
            addMembersToWizardAndNav(wizard, searchResultsToMembers(r), message => {
              setWaiting(false)
              setError(message)
            })
          )
        } else {
          setWaiting(false)
          setError('Could not add any of the selected contacts. Try another contact or method.')
        }
      },
      err => {
        setWaiting(false)
        setError(err.message)
      }
    )
  }

  Kb.useModalHeaderAction({
    enabled: !noneSelected,
    label: 'Done',
    onAction: onDone,
    title: 'Add members',
    waiting,
  })

  return (
    <>
      <Kb.ErrorBanner error={error} />
      <Kb.SearchFilter
        size="small"
        onChange={setSearch}
        value={search}
        placeholderText={placeholderText}
        placeholderCentered={true}
        icon="iconfont-search"
      />
      <ContactsList
        onSelect={onSelectContact}
        search={search}
        selectedEmails={selectedEmails}
        selectedPhones={selectedPhones}
      />
      <EnableContactsPopup noAccess={noAccessPermanent} onClose={onBack} />
    </>
  )
}

const AddContacts = (props: {wizard: AddMembersWizard}) => {
  if (!isMobile) return null
  return <AddContactsMobile {...props} />
}

export default AddContacts
