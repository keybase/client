import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import {Section as _Section} from '../../common-adapters/section-list'
import useContacts from '../../teams/invite-by-contact/use-contacts.native'
import {Contact} from '../../teams/invite-by-contact/index.native'
import {memoize} from '../../util/memoize'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import {mapGetEnsureValue} from '../../util/map'

type Section = _Section<Contact, {title: string}>

const categorize = (contact: Contact): string => {
  if (!contact.name) {
    return '0-9'
  }
  const firstLetter = contact.name[0].toUpperCase()
  if ('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.includes(firstLetter)) {
    return firstLetter
  } else if ('0123456789'.includes(firstLetter)) {
    return '0-9'
  } else {
    return 'Other'
  }
}
const filterAndSectionContacts = memoize((contacts: Contact[], search: string): Section[] => {
  const searchL = search.toLowerCase()
  const sectionMap: Map<string, Contact[]> = new Map()
  contacts
    .filter(contact => contact.name.toLowerCase().includes(searchL) || contact.value.includes(search))
    .forEach(contact => {
      const category = categorize(contact)
      const section = mapGetEnsureValue(sectionMap, category, [])
      section.push(contact)
    })
  const sections: Section[] = []
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (sectionMap.has(letter)) {
      sections.push({
        data: sectionMap.get(letter)!,
        key: letter,
        title: letter,
      })
    }
  }
  for (const sectionKey of ['0-9', 'Other']) {
    if (sectionMap.has(sectionKey)) {
      sections.push({
        data: sectionMap.get(sectionKey)!,
        key: sectionKey,
        title: sectionKey,
      })
    }
  }
  return sections
})

const InviteContacts = () => {
  const {contacts, errorMessage, loading} = useContacts()
  const [search, setSearch] = React.useState('')
  const [selectedContacts, setSelectedContacts] = React.useState(new Set<string>())
  const canContinue = selectedContacts.size > 0

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const navUp = () => dispatch(nav.safeNavigateUpPayload())
  const onSubmit = () => {} // TODO

  const placeholderText = loading ? '' : `Search ${contacts.length.toLocaleString()} contacts`

  const sections = [
    {data: [], key: 'headerIcon', title: 'headerIcon'},
    ...filterAndSectionContacts(contacts, search),
  ]
  const renderSectionHeader = ({section}: {section: Section}) =>
    section.title === 'headerIcon' ? (
      <Kb.Icon type="icon-illustration-invite-friends-460-96" style={styles.iconBox} />
    ) : (
      <Kb.SectionDivider label={section.title} />
    )
  const renderItem = ({item, index}: {item: Contact; index: number}) => {
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
    const checked = selectedContacts.has(item.value)
    return (
      <Kb.ListItem2
        type="Small"
        firstItem={index === 0}
        body={
          <Kb.Box2 direction="vertical" alignItems="flex-start">
            <Kb.Text type="BodySemibold">{topText}</Kb.Text>
            {bottomText && <Kb.Text type="BodySmall">{bottomText}</Kb.Text>}
          </Kb.Box2>
        }
        onClick={() => onCheck(!checked)}
        action={<Kb.CheckCircle checked={checked} onCheck={onCheck} style={styles.checkCircle} />}
        icon={
          item.pictureUri ? (
            <Kb.NativeImage style={styles.thumbnail} source={{uri: item.pictureUri}} />
          ) : (
            undefined
          )
        }
      />
    )
  }
  const keyExtractor = (item: Contact) => item.id
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.ModalHeader
        leftButton={
          <Kb.Text type="BodyPrimaryLink" onClick={navUp}>
            Cancel
          </Kb.Text>
        }
        rightButton={
          <Kb.Text
            type="BodyPrimaryLink"
            onClick={canContinue ? onSubmit : undefined}
            style={canContinue ? undefined : styles.disabledLink}
          >
            Invite
          </Kb.Text>
        }
        title="Invite friends"
      />
      {!!errorMessage && <Kb.Banner color="red">{errorMessage}</Kb.Banner>}
      {loading ? (
        <Kb.ProgressIndicator type="Huge" />
      ) : (
        <Kb.SearchFilter
          size="small"
          onChange={setSearch}
          value={search}
          placeholderText={placeholderText}
          placeholderCentered={true}
          icon="iconfont-search"
        />
      )}
      <Kb.SectionList
        sections={sections}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
      />
    </Kb.Box2>
  )
}
export default InviteContacts

const styles = Styles.styleSheetCreate(() => ({
  checkCircle: {
    marginRight: 24,
  },
  disabledLink: {
    opacity: 0.5,
  },
  iconBox: {
    alignSelf: 'center',
  },
  thumbnail: {
    borderRadius: 16,
    height: 32,
    marginLeft: 16,
    marginRight: 16,
    width: 32,
  },
}))
