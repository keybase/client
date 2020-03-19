import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import {Section as _Section} from '../../common-adapters/section-list'
import useContacts from '../../teams/invite-by-contact/use-contacts.native'
import {ContactProps as Contact} from '../../teams/invite-by-contact/index.native'
import {memoize} from '../../util/memoize'
import * as Container from '../../util/container'

type Section = _Section<Contact, {title: string}>

const filterAndSectionContacts = memoize((contacts: Contact[], search: string): Section[] => {
  return [
    {
      data: contacts,
      key: 'A',
      title: search,
    },
  ]
})

const InviteContacts = () => {
  const {contacts} = useContacts()
  const [search, setSearch] = React.useState('')
  const [selectedContacts, setSelectedContacts] = React.useState(new Set<string>())

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const navUp = () => dispatch(nav.safeNavigateUpPayload())
  const onSubmit = () => {} // TODO

  const placeholderText = `Search ${contacts.length.toLocaleString()} contacts`

  const sections = filterAndSectionContacts(contacts, search)
  const renderSectionHeader = ({section}: {section: Section}) => <Kb.SectionDivider label={section.title} />
  const renderItem = ({item}: {item: Contact}) => {
    const topText = item.name ?? item.valueFormatted ?? item.value
    const bottomText = item.name ? item.valueFormatted ?? item.value : undefined
    const onCheck = (check: boolean) => {
      if (check) {
        selectedContacts.add(item.value)
      } else {
        selectedContacts.delete(item.value)
      }
      setSelectedContacts(new Set(selectedContacts))
    }
    return (
      <Kb.ListItem2
        type="Small"
        firstItem={false}
        body={
          <Kb.Box2 direction="vertical" alignItems="flex-start">
            <Kb.Text type="BodySemibold">{topText}</Kb.Text>
            {bottomText && <Kb.Text type="BodySmall">{bottomText}</Kb.Text>}
          </Kb.Box2>
        }
        action={<Kb.CheckCircle checked={selectedContacts.has(item.value)} onCheck={onCheck} />}
        icon={item.pictureUri ? <Kb.NativeImage source={{uri: item.pictureUri}} /> : undefined}
      />
    )
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.ModalHeader
        leftButton={
          <Kb.Text type="BodyPrimaryLink" onClick={navUp}>
            Cancel
          </Kb.Text>
        }
        rightButton={
          <Kb.Text type="BodyPrimaryLink" onClick={onSubmit}>
            Invite
          </Kb.Text>
        }
        title="Invite friends"
      />
      <Kb.SearchFilter size="small" onChange={setSearch} value={search} placeholderText={placeholderText} />
      <Kb.Icon type="icon-illustration-invite-friends-460-96" />
      <Kb.SectionList sections={sections} renderSectionHeader={renderSectionHeader} renderItem={renderItem} />
    </Kb.Box2>
  )
}
export default InviteContacts
