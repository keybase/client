import * as C from '@/constants'
import * as React from 'react'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {pluralize} from '@/util/string'
import ContactsList, {useContacts, EnableContactsPopup} from '../common/contacts-list.native'
import {useModalHeaderState} from '@/stores/modal-header'
import type {Contact} from '../common/contacts-list.native'

const AddContacts = () => {
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => navigateUp()
  const [search, setSearch] = React.useState('')
  const [selectedPhones, setSelectedPhones] = React.useState(new Set<string>())
  const [selectedEmails, setSelectedEmails] = React.useState(new Set<string>())
  const {contacts, loading, noAccessPermanent} = useContacts()
  const placeholderText = loading ? '' : `Search ${contacts.length} ${pluralize('contact', contacts.length)}`

  const onSelectContact = (contact: Contact, checked: boolean) => {
    if (contact.type === 'phone') {
      checked ? selectedPhones.add(contact.value) : selectedPhones.delete(contact.value)
      setSelectedPhones(new Set(selectedPhones))
    } else {
      checked ? selectedEmails.add(contact.value) : selectedEmails.delete(contact.value)
      setSelectedEmails(new Set(selectedEmails))
    }
  }

  const [waiting, setWaiting] = React.useState(false)
  const toAssertionsRPC = C.useRPC(T.RPCGen.userSearchBulkEmailOrPhoneSearchRpcPromise)

  const addMembersWizardPushMembers = useTeamsState(s => s.dispatch.addMembersWizardPushMembers)

  const noneSelected = selectedPhones.size + selectedEmails.size === 0

  React.useEffect(() => {
    const onDone = () => {
      if (waiting) {
        return
      }
      setWaiting(true)
      toAssertionsRPC(
        [{emails: [...selectedEmails].join(','), phoneNumbers: [...selectedPhones]}],
        r => {
          if (r?.length) {
            addMembersWizardPushMembers(
              r.map(m => ({
                ...(m.foundUser
                  ? {assertion: m.username, resolvedFrom: m.assertion}
                  : {assertion: m.assertion}),
                role: 'writer',
              }))
            )
          }
        },
        err => {
          console.warn(err)
        }
      )
    }
    useModalHeaderState.setState({
      actionEnabled: !noneSelected,
      actionWaiting: waiting,
      onAction: onDone,
      title: 'Add members',
    })
    return () => {
      useModalHeaderState.setState({actionEnabled: false, actionWaiting: false, onAction: undefined, title: ''})
    }
  }, [waiting, selectedEmails, selectedPhones, toAssertionsRPC, addMembersWizardPushMembers, noneSelected])

  return (
    <>
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

export default AddContacts
