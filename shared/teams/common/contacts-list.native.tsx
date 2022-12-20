import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import type {Section as _Section} from '../../common-adapters/section-list'
import useContacts, {type Contact as _Contact} from './use-contacts.native'
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
  emailsDisabled?: boolean
  phonesDisabled?: boolean
  disabledTooltip?: string
  ListHeaderComponent?: React.ComponentProps<typeof Kb.SectionList>['ListHeaderComponent']
  onSelect: (contact: Contact, checked: boolean) => void
  search: string
  selectedEmails: Set<string>
  selectedPhones: Set<string>
}

type ContactRowProps = {
  disabled?: boolean
  disabledTooltip?: string
  index: number
  item: Contact
  onSelect: Props['onSelect']
  selected: boolean
}
const ContactRow = React.memo(
  ({item, disabled, disabledTooltip, index, onSelect, selected}: ContactRowProps) => {
    const topText = item.name ?? item.valueFormatted ?? item.value
    const bottomText = item.name ? item.valueFormatted ?? item.value : undefined
    const onCheck = (check: boolean) => onSelect(item, check)
    const listItem = (
      <Kb.ListItem2
        type="Small"
        firstItem={index === 0}
        body={
          <Kb.Box2 direction="vertical" alignItems="flex-start">
            <Kb.Text type="BodySemibold">{topText}</Kb.Text>
            {bottomText && <Kb.Text type="BodySmall">{bottomText}</Kb.Text>}
          </Kb.Box2>
        }
        onClick={disabled ? undefined : () => onCheck(!selected)}
        action={
          <Kb.CheckCircle
            checked={selected}
            onCheck={onCheck}
            style={styles.checkCircle}
            disabled={disabled}
          />
        }
        icon={
          item.pictureUri ? (
            <Kb.NativeImage style={styles.thumbnail} source={{uri: item.pictureUri}} />
          ) : (
            <Kb.Avatar size={32} username="" />
          )
        }
      />
    )
    return disabledTooltip ? (
      <Kb.WithTooltip showOnPressMobile={true} tooltip={disabledTooltip} multiline={true}>
        {listItem}
      </Kb.WithTooltip>
    ) : (
      listItem
    )
  }
)

const ContactsList = (props: Props) => {
  const contactInfo = useContacts()

  const sections = filterAndSectionContacts(contactInfo.contacts, props.search)
  const renderSectionHeader = ({section}: {section: Section}) => <Kb.SectionDivider label={section.title} />
  const keyExtractor = (item: Contact) => item.id

  // need to box this callback or every row will rerender when the selection changes
  const {onSelect} = props
  const onSelectRef = React.useRef(props.onSelect)
  React.useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])
  const onSelectForRows = React.useCallback<Props['onSelect']>(
    (...args) => {
      onSelectRef.current(...args)
    },
    [onSelectRef]
  )

  return (
    <Kb.SectionList
      sections={sections}
      renderSectionHeader={renderSectionHeader}
      renderItem={({item, index}) => {
        const disabled = item.type === 'email' ? props.emailsDisabled : props.phonesDisabled
        return (
          <ContactRow
            item={item}
            index={index}
            onSelect={onSelectForRows}
            disabled={disabled}
            disabledTooltip={disabled ? props.disabledTooltip : undefined}
            selected={
              item.type === 'email'
                ? props.selectedEmails.has(item.value)
                : props.selectedPhones.has(item.value)
            }
          />
        )
      }}
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

// convenience exports of stuff likely used with this component
export type Contact = _Contact
export {useContacts}
export {default as EnableContactsPopup} from './enable-contacts'
export default ContactsList
