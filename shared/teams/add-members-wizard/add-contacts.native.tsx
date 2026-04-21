import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {pluralize} from '@/util/string'
import ContactsList, {useContacts, EnableContactsPopup} from '../common/contacts-list.native'
import {useModalHeaderState} from '@/stores/modal-header'
import type {Contact} from '../common/contacts-list.native'
import {addMembersToWizard, type AddMembersWizard} from './state'

const AddContacts = ({route}: {route: {params: {wizard: AddMembersWizard}}}) => {
  const navigateUp = C.Router2.navigateUp
  const navigateAppend = C.Router2.navigateAppend
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
            const f = async () => {
              const wizard = await addMembersToWizard(
                route.params.wizard,
                r.map(m => ({
                  ...(m.foundUser ? {assertion: m.username, resolvedFrom: m.assertion} : {assertion: m.assertion}),
                  role: 'writer',
                }))
              )
              navigateAppend({name: 'teamAddToTeamConfirm', params: {wizard}}, true)
            }
            C.ignorePromise(f())
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
  }, [waiting, selectedEmails, selectedPhones, toAssertionsRPC, navigateAppend, noneSelected, route.params.wizard])

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
