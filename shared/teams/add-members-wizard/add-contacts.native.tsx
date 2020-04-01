import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import {pluralize} from '../../util/string'
import {ModalTitle} from '../common'
import ContactsList, {useContacts, Contact, EnableContactsPopup} from '../common/contacts-list.native'

const AddContacts = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const teamID = Container.useSelector(s => s.teams.addMembersWizard.teamID)
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

  const noneSelected = selectedPhones.size + selectedEmails.size === 0

  return (
    <Kb.Modal
      noScrollView={true}
      header={{
        hideBorder: true,
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        rightButton: (
          <Kb.Text type="BodyBigLink" style={noneSelected && Styles.globalStyles.opacity0}>
            TODO
          </Kb.Text>
        ),
        title: <ModalTitle teamID={teamID} title="Add members" />,
      }}
    >
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
    </Kb.Modal>
  )
}

export default AddContacts
