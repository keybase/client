import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import {Section as _Section} from '../../common-adapters/section-list'
import useContacts from '../../teams/invite-by-contact/use-contacts.native'
import {Contact} from '../../teams/invite-by-contact/index.native'
import {memoize} from '../../util/memoize'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import {mapGetEnsureValue} from '../../util/map'
import * as RPCGen from '../../constants/types/rpc-gen'

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

const waitingKey = 'inviteContacts'

const InviteContacts = () => {
  const contactInfo = useContacts()
  const {contacts, loading} = contactInfo
  const contactsErrorMessage = contactInfo.errorMessage
  const [search, setSearch] = React.useState('')
  const [selectedPhones, setSelectedPhones] = React.useState(new Set<string>())
  const [selectedEmails, setSelectedEmails] = React.useState(new Set<string>())
  const canContinue = selectedPhones.size + selectedEmails.size > 0

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const navUp = () => dispatch(nav.safeNavigateUpPayload())
  const waiting = Container.useAnyWaiting(waitingKey)

  const submit = Container.useRPC(RPCGen.inviteFriendsInvitePeopleRpcPromise)
  const [rpcErrorMessage, setError] = React.useState('')
  const onSubmit = () => {
    setError('')
    submit(
      [
        {
          emails: {emailsFromContacts: [...selectedEmails]},
          phones: [...selectedPhones],
        },
        waitingKey,
      ],
      () => {
        // TODO(Y2K-1643): positive feedback
        navUp()
      },
      err => {
        setError(err.message)
      }
    )
  }
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
      if (item.type === 'phone') {
        if (check) {
          selectedPhones.add(item.value)
        } else {
          selectedPhones.delete(item.value)
        }
        setSelectedPhones(new Set(selectedPhones))
      } else {
        if (check) {
          selectedEmails.add(item.value)
        } else {
          selectedEmails.delete(item.value)
        }
        setSelectedEmails(new Set(selectedEmails))
      }
    }
    const checked = item.type === 'email' ? selectedEmails.has(item.value) : selectedPhones.has(item.value)
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
    <Kb.Modal
      noScrollView={true}
      header={{
        hideBorder: true,
        leftButton: (
          <Kb.Text type="BodyBigLink" onClick={navUp}>
            Cancel
          </Kb.Text>
        ),
        rightButton: waiting ? (
          <Kb.ProgressIndicator type="Small" />
        ) : (
          <Kb.Text
            type="BodyBigLink"
            onClick={canContinue ? onSubmit : undefined}
            style={canContinue ? undefined : styles.disabledLink}
          >
            Invite
          </Kb.Text>
        ),
        title: 'Invite friends',
      }}
    >
      {(!!contactsErrorMessage || !!rpcErrorMessage) && (
        <Kb.Banner color="red">{contactsErrorMessage ?? rpcErrorMessage}</Kb.Banner>
      )}
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
    </Kb.Modal>
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
