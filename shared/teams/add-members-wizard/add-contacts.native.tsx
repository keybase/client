import * as C from '@/constants'
import * as React from 'react'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {pluralize} from '@/util/string'
import {ModalTitle} from '../common'
import ContactsList, {useContacts, EnableContactsPopup, type Contact} from '../common/contacts-list.native'

const AddContacts = () => {
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => navigateUp()
  const teamID = useTeamsState(s => s.addMembersWizard.teamID)
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

  const navForHeader = C.useNav()
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
    navForHeader.setOptions({
      headerRight: () => (
        <Kb.Box2 direction="horizontal" style={Kb.Styles.globalStyles.positionRelative}>
          <Kb.Text
            type="BodyBigLink"
            onClick={onDone}
            style={Kb.Styles.collapseStyles([
              noneSelected && Kb.Styles.globalStyles.opacity0,
              waiting && styles.opacity40,
            ])}
          >
            Done
          </Kb.Text>
          {waiting && (
            <Kb.Box2
              direction="horizontal"
              centerChildren={true}
              style={Kb.Styles.globalStyles.fillAbsolute}
            >
              <Kb.ProgressIndicator />
            </Kb.Box2>
          )}
        </Kb.Box2>
      ),
      headerTitle: () => <ModalTitle teamID={teamID} title="Add members" />,
    })
  }, [navForHeader, waiting, selectedEmails, selectedPhones, toAssertionsRPC, addMembersWizardPushMembers, noneSelected, teamID])

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

const styles = Kb.Styles.styleSheetCreate(() => ({
  opacity40: {opacity: 0.4},
}))

export default AddContacts
