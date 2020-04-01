import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import {Section as _Section} from '../../common-adapters/section-list'
import useContacts, {Contact} from './use-contacts.native'
import {memoize} from '../../util/memoize'
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
    .filter(
      contact => contact.name.toLowerCase().includes(searchL) || contact.value.toLowerCase().includes(searchL)
    )
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

type Props = {
  disabled?: boolean
  ListHeaderComponent: React.ComponentProps<typeof Kb.SectionList>['ListHeaderComponent']
  onSelect: (contact: Contact, checked: boolean) => void
  search: string
  selectedEmails: Set<string>
  selectedPhones: Set<string>
}

const ContactsList = (props: Props) => {
  const contactInfo = useContacts()

  const sections = filterAndSectionContacts(contactInfo.contacts, props.search)
  const renderSectionHeader = ({section}: {section: Section}) => <Kb.SectionDivider label={section.title} />
  const renderItem = ({item, index}: {item: Contact; index: number}) => {
    const topText = item.name ?? item.valueFormatted ?? item.value
    const bottomText = item.name ? item.valueFormatted ?? item.value : undefined
    const onCheck = (check: boolean) => props.onSelect(item, check)
    const checked =
      item.type === 'email' ? props.selectedEmails.has(item.value) : props.selectedPhones.has(item.value)
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
        onClick={props.disabled ? undefined : () => onCheck(!checked)}
        action={
          <Kb.CheckCircle
            checked={checked}
            onCheck={onCheck}
            style={styles.checkCircle}
            disabled={props.disabled}
          />
        }
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
    <Kb.SectionList
      sections={sections}
      renderSectionHeader={renderSectionHeader}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={props.ListHeaderComponent}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  checkCircle: {
    marginRight: 24,
  },
  thumbnail: {
    borderRadius: 16,
    height: 32,
    marginLeft: 16,
    marginRight: 16,
    width: 32,
  },
}))

export default ContactsList
