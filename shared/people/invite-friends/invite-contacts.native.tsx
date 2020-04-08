import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import * as RPCGen from '../../constants/types/rpc-gen'
import {pluralize} from '../../util/string'
import ContactsList, {
  useContacts,
  Contact,
  EnableContactsPopup,
} from '../../teams/common/contacts-list.native'

const waitingKey = 'inviteContacts'

const ListHeaderComponent = () => (
  <Kb.Icon type="icon-illustration-invite-friends-460-96" style={styles.iconBox} />
)

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
  const [successCount, setSuccessCount] = React.useState(0)
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
      r => setSuccessCount(r),
      err => {
        setError(err.message)
      }
    )
  }
  const placeholderText = loading ? '' : `Search ${contacts.length.toLocaleString()} contacts`

  const disabled = !!successCount
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
  return (
    <Kb.Modal
      noScrollView={true}
      header={{
        hideBorder: true,
        leftButton: (
          <Kb.Text type="BodyBigLink" onClick={navUp}>
            {successCount ? 'Close' : 'Cancel'}
          </Kb.Text>
        ),
        rightButton: successCount ? (
          undefined
        ) : waiting ? (
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
      footer={
        successCount
          ? {content: <Kb.Button onClick={navUp} small={true} fullWidth={true} label="Close" />}
          : undefined
      }
    >
      {(!!contactsErrorMessage || !!rpcErrorMessage) && (
        <Kb.Banner color="red">{contactsErrorMessage ?? rpcErrorMessage}</Kb.Banner>
      )}
      {successCount ? (
        <Kb.Banner color="green" style={styles.banner}>{`Yeeha! You invited ${successCount} ${pluralize(
          'contact',
          successCount
        )}.`}</Kb.Banner>
      ) : loading ? (
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
      <ContactsList
        disabled={disabled}
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
}))
