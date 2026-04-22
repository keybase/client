import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {pluralize} from '@/util/string'
import ContactsList, {useContacts, EnableContactsPopup} from '../common/contacts-list.native'
import {useModalHeaderState} from '@/stores/modal-header'
import type {Contact} from '../common/contacts-list.native'
import {addMembersToWizard, type AddMembersWizard} from './state'

const AddContacts = ({wizard}: {wizard: AddMembersWizard}) => {
  const navigateUp = C.Router2.navigateUp
  const navUpToScreen = C.Router2.navUpToScreen
  const onBack = () => navigateUp()
  const [search, setSearch] = React.useState('')
  const [selectedPhones, setSelectedPhones] = React.useState(new Set<string>())
  const [selectedEmails, setSelectedEmails] = React.useState(new Set<string>())
  const [error, setError] = React.useState('')
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
      setError('')
      setWaiting(true)
      toAssertionsRPC(
        [{emails: [...selectedEmails].join(','), phoneNumbers: [...selectedPhones]}],
        r => {
          if (r?.length) {
            const f = async () => {
              try {
                const nextWizard = await addMembersToWizard(
                  wizard,
                  r.map(m => ({
                    ...(m.foundUser
                      ? {assertion: m.username, resolvedFrom: m.assertion}
                      : {assertion: m.assertion}),
                    role: 'writer',
                  }))
                )
                navUpToScreen({name: 'teamAddToTeamConfirm', params: {wizard: nextWizard}}, true)
              } catch (err) {
                setWaiting(false)
                setError(err instanceof Error ? err.message : String(err))
              }
            }
            C.ignorePromise(f())
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
    useModalHeaderState.setState({
      actionEnabled: !noneSelected,
      actionWaiting: waiting,
      onAction: onDone,
      title: 'Add members',
    })
    return () => {
      useModalHeaderState.setState({actionEnabled: false, actionWaiting: false, onAction: undefined, title: ''})
    }
  }, [waiting, selectedEmails, selectedPhones, toAssertionsRPC, navUpToScreen, noneSelected, wizard])

  return (
    <>
      {error ? (
        <Kb.Banner color="red" key="err">
          {error}
        </Kb.Banner>
      ) : null}
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
