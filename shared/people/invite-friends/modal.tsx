import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as SettingsGen from '../../actions/settings-gen'
import {usePhoneNumberList} from '../../teams/common'
import * as RPCGen from '../../constants/types/rpc-gen'
import {pluralize} from '../../util/string'

const shareURL = 'https://keybase.io/download?invite'
const waitingKey = 'invitePeople'

const InviteFriendsModal = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onClose = () => dispatch(nav.safeNavigateUpPayload())
  const defaultCountry = Container.useSelector(s => s.settings.phoneNumbers.defaultCountry)

  React.useEffect(() => {
    // TODO: phone input should do this + remove from uses
    if (!defaultCountry) {
      dispatch(SettingsGen.createLoadDefaultPhoneNumberCountry())
    }
  }, [defaultCountry, dispatch])

  const [emails, setEmails] = React.useState('')
  const {
    phoneNumbers,
    setPhoneNumber,
    addPhoneNumber,
    removePhoneNumber,
    resetPhoneNumbers,
  } = usePhoneNumberList()

  // disabled if both are empty or if there are some invalid phone numbers
  const disabled =
    (!emails && phoneNumbers.every(pn => !pn.phoneNumber)) ||
    phoneNumbers.some(pn => pn.phoneNumber && !pn.valid)

  const submit = Container.useRPC(RPCGen.inviteFriendsInvitePeopleRpcPromise)
  const [error, setError] = React.useState('')
  const [successCount, setSuccessCount] = React.useState<number | null>(null)
  const onSubmit = () =>
    submit(
      [
        {
          emails: {commaSeparatedEmailsFromUser: emails},
          phones: phoneNumbers.filter(p => !!p.phoneNumber).map(p => p.phoneNumber),
        },
        waitingKey,
      ],
      r => {
        setSuccessCount(r)
        setError('')
        setEmails('')
        resetPhoneNumbers()
      },
      err => {
        setSuccessCount(null)
        if (err.code === RPCGen.StatusCode.scratelimit) {
          setError("You've been doing that a bit too much lately. Try again later.")
        } else {
          setError(err.message)
        }
      }
    )
  const {popup, setShowingPopup} = Kb.usePopup(() => (
    <ShareLinkPopup onClose={() => setShowingPopup(false)} />
  ))
  return (
    <Kb.Modal
      mode="DefaultFullHeight"
      onClose={onClose}
      header={{
        leftButton: Styles.isMobile && (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            Cancel
          </Kb.Text>
        ),
        title: Styles.isMobile ? 'Invite friends' : 'Invite your friends to Keybase',
      }}
      footer={{
        content: (
          <Kb.Box2 direction="vertical" gap="medium" fullWidth={true}>
            <Kb.WaitingButton
              fullWidth={true}
              type="Success"
              label="Send invite"
              disabled={disabled}
              waitingKey={waitingKey}
              onClick={onSubmit}
            />
            {!Styles.isMobile && (
              <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
                <Kb.Text type="BodySmall" center={true}>
                  or share a link:
                </Kb.Text>
                <Kb.CopyText text={shareURL} />
              </Kb.Box2>
            )}
          </Kb.Box2>
        ),
      }}
      banners={[
        ...(error
          ? [
              <Kb.Banner color="red" key="error" style={styles.banner}>
                {error}
              </Kb.Banner>,
            ]
          : []),
        ...(successCount === null
          ? []
          : [
              <Kb.Banner
                color="green"
                key="success"
                style={styles.banner}
              >{`Yeehaw! You invited ${successCount} ${pluralize('friend', successCount)}.`}</Kb.Banner>,
            ]),
      ]}
    >
      <Kb.Box2 direction="vertical" gap="small" fullWidth={true} alignItems="center" style={styles.container}>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          centerChildren={true}
          style={styles.illustrationContainer}
        >
          <Kb.Icon type="icon-illustration-invite-friends-460-96" />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" gap="small" fullWidth={true} style={styles.content}>
          <Kb.Box2 direction="vertical" gap={Styles.isMobile ? 'xtiny' : 'tiny'} fullWidth={true}>
            <Kb.Text type="BodySmallSemibold">By email address (separate with commas)</Kb.Text>
            <Kb.LabeledInput
              multiline={true}
              hoverPlaceholder="Ex: cori@domain.com, paul@domain.com, etc."
              placeholder="Email addresses"
              rowsMin={3}
              value={emails}
              onChangeText={setEmails}
            />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" gap={Styles.isMobile ? 'xtiny' : 'tiny'} fullWidth={true}>
            <Kb.Text type="BodySmallSemibold">By phone number</Kb.Text>
            <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
              {phoneNumbers.map((pn, i) => (
                <Kb.PhoneInput
                  small={true}
                  key={pn.key}
                  defaultCountry={defaultCountry}
                  onChangeNumber={(phoneNumber, valid) => setPhoneNumber(i, phoneNumber, valid)}
                  onClear={phoneNumbers.length === 1 ? undefined : () => removePhoneNumber(i)}
                />
              ))}
              <Kb.Button
                mode="Secondary"
                icon="iconfont-new"
                onClick={addPhoneNumber}
                style={styles.alignSelfStart}
              />
            </Kb.Box2>
          </Kb.Box2>
          {Styles.isMobile && (
            <Kb.ClickableBox style={styles.shareALink} onClick={() => setShowingPopup(true)}>
              <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center" alignSelf="flex-start">
                <Kb.Icon type="iconfont-link" color={Styles.globalColors.blueDark} />
                <Kb.Text type="BodyPrimaryLink">or share a link</Kb.Text>
              </Kb.Box2>
              {popup}
            </Kb.ClickableBox>
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

export const ShareLinkPopup = ({onClose}: {onClose: () => void}) => (
  <Kb.MobilePopup>
    <Kb.Box2 direction="vertical" style={styles.linkPopupContainer} gap="small" fullWidth={true}>
      <Kb.Text type="Header">Share a link to Keybase</Kb.Text>
      <Kb.CopyText text={shareURL} shareSheet={true} />
      <Kb.Button type="Dim" label="Close" fullWidth={true} onClick={onClose} />
    </Kb.Box2>
  </Kb.MobilePopup>
)

const styles = Styles.styleSheetCreate(() => ({
  alignSelfStart: {alignSelf: 'flex-start'},
  banner: {
    position: 'absolute',
    top: 47,
    zIndex: 1,
  },
  container: {
    backgroundColor: Styles.globalColors.blueGrey,
    flex: 1,
  },
  content: {
    ...Styles.padding(0, Styles.globalMargins.small, Styles.globalMargins.small),
  },
  illustrationContainer: {
    backgroundColor: Styles.globalColors.purpleLight,
    overflow: 'hidden',
  },
  linkPopupContainer: {
    ...Styles.padding(Styles.globalMargins.small),
  },
  shareALink: {
    ...Styles.padding(Styles.globalMargins.tiny, 0),
    width: '100%',
  },
}))

export default InviteFriendsModal
