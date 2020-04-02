import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import * as TeamsGen from '../../actions/teams-gen'
import * as RPCGen from '../../constants/types/rpc-gen'
import {pluralize} from '../../util/string'
import {ModalTitle} from '../common'
import ContactsList, {useContacts, Contact, EnableContactsPopup} from '../common/contacts-list.native'
import {formatPhoneNumber} from '../../util/phone-numbers'

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

  const [waiting, setWaiting] = React.useState(false)
  const toAssertionsRPC = Container.useRPC(RPCGen.userSearchBulkEmailOrPhoneSearchRpcPromise)
  const onDone = () => {
    setWaiting(true)
    toAssertionsRPC(
      [{emails: [...selectedEmails].join(','), phoneNumbers: [...selectedPhones]}],
      r => {
        if (r?.length) {
          dispatch(
            TeamsGen.createAddMembersWizardPushMembers({
              members: r.map(m => ({
                assertion: m.foundUser ? m.username : m.assertion,
                note: m.foundUser ? formatPhoneNumber(m.input) : undefined,
                role: 'writer',
              })),
            })
          )
        }
      },
      err => {
        console.warn(err)
      }
    )
  }

  const noneSelected = selectedPhones.size + selectedEmails.size === 0

  return (
    <Kb.Modal
      noScrollView={true}
      header={{
        hideBorder: true,
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        rightButton: (
          <Kb.Text type="BodyBigLink" onClick={onDone} style={noneSelected && Styles.globalStyles.opacity0}>
            Done
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
