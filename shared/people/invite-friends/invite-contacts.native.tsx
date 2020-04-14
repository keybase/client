import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import ContactsList, {
  useContacts,
  Contact,
  EnableContactsPopup,
} from '../../teams/common/contacts-list.native'
import openSMS from '../../util/sms'
import {composeAsync} from 'expo-mail-composer'

const waitingKey = 'inviteContacts'

const ListHeaderComponent = () => (
  <Kb.Icon type="icon-illustration-invite-friends-460-96" style={styles.iconBox} />
)

const messageSubject = "Let's chat on Keybase?"
const messageBody = `Let's chat privately on Keybase:
https://keybase.io/download?invite
It's free and secure.`

// Doesn't return anything about the status of the message.
// Resolves if we succeeded in opening composer, rejects otherwise
const onComposeMessage = ({
  emails,
  phones,
}: {
  emails?: Array<string>
  phones?: Array<string>
}): Promise<void> => {
  if ((emails && phones) || (!emails && !phones)) {
    return Promise.reject('Invalid params')
  }
  if (phones) {
    return openSMS(phones, messageBody)
  }
  return composeAsync({body: messageBody, recipients: emails, subject: messageSubject}).then(() => undefined)
}

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

  const anyPhonesSelected = !!selectedPhones.size
  const anyEmailsSelected = !!selectedEmails.size
  const [composerError, setError] = React.useState('')
  const onSubmit = async () => {
    setError('')
    try {
      if (!anyPhonesSelected && !anyEmailsSelected) {
        setError('Select at least one contact.')
        return
      }
      if (anyPhonesSelected) {
        await onComposeMessage({phones: [...selectedPhones]})
        navUp()
      } else {
        await onComposeMessage({emails: [...selectedEmails]})
        navUp()
      }
    } catch (e) {
      if (anyEmailsSelected && Styles.isIOS) {
        setError(
          'Something went wrong. For this feature to work, you need at least one Mail account enabled in settings.'
        )
      } else {
        setError('Something went wrong.')
      }
    }
  }
  const placeholderText = loading ? '' : `Search ${contacts.length.toLocaleString()} contacts`

  const emailsDisabled = anyPhonesSelected
  const phonesDisabled = anyEmailsSelected
  const [anySelected, setAnySelected] = React.useState(false)
  React.useEffect(() => {
    const newAnySelected = anyPhonesSelected || anyEmailsSelected
    if (newAnySelected !== anySelected) {
      // this RAF is a hack so we don't animate the list items changing enabled <-> disabled
      requestAnimationFrame(() => {
        setAnySelected(newAnySelected)
        Kb.LayoutAnimation.configureNext(Kb.LayoutAnimation.Presets.easeInEaseOut)
      })
    }
  }, [anyPhonesSelected, anyEmailsSelected, anySelected])
  const disabledTooltip =
    emailsDisabled || phonesDisabled
      ? `You can't select both email addresses and phone numbers. To select ${
          anyEmailsSelected ? 'phone numbers' : 'email addresses'
        }, click Unselect and start again.`
      : undefined

  const onSelectContact = (contact: Contact, checked: boolean) => {
    if (contact.type === 'phone') {
      if (checked) {
        selectedPhones.add(contact.value)
      } else {
        selectedPhones.delete(contact.value)
      }
      setSelectedPhones(new Set(selectedPhones))
    } else {
      if (checked) {
        selectedEmails.add(contact.value)
      } else {
        selectedEmails.delete(contact.value)
      }
      setSelectedEmails(new Set(selectedEmails))
    }
  }
  const onUnselect = () => {
    setSelectedPhones(new Set())
    setSelectedEmails(new Set())
  }
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
      {(!!contactsErrorMessage || !!composerError) && (
        <Kb.Banner color="red">{contactsErrorMessage ?? composerError}</Kb.Banner>
      )}
      {loading ? (
        <Kb.ProgressIndicator type="Huge" />
      ) : (
        <Kb.Box2 direction="horizontal" gapEnd={true} alignItems="center">
          <Kb.SearchFilter
            size="small"
            onChange={setSearch}
            value={search}
            placeholderText={placeholderText}
            placeholderCentered={true}
            style={Styles.globalStyles.flexOne}
            icon="iconfont-search"
          />
          {anySelected && (
            <Kb.Text type="BodyPrimaryLink" onClick={onUnselect} style={styles.unselect}>
              Unselect
            </Kb.Text>
          )}
        </Kb.Box2>
      )}
      <ContactsList
        emailsDisabled={emailsDisabled}
        phonesDisabled={phonesDisabled}
        disabledTooltip={disabledTooltip}
        ListHeaderComponent={ListHeaderComponent}
        onSelect={onSelectContact}
        search={search}
        selectedEmails={selectedEmails}
        selectedPhones={selectedPhones}
      />
      <EnableContactsPopup noAccess={contactInfo.noAccessPermanent} onClose={navUp} />
    </Kb.Modal>
  )
}
export default InviteContacts

const styles = Styles.styleSheetCreate(() => ({
  banner: {
    position: 'absolute',
    top: 47,
    zIndex: 1,
  },
  disabledLink: {
    opacity: 0.5,
  },
  iconBox: {
    alignSelf: 'center',
  },
  unselect: {marginRight: Styles.globalMargins.xsmall},
}))
