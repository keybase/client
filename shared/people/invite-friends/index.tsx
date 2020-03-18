import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import {usePhoneNumberList} from '../../teams/common'

const InviteFriends = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onClose = () => dispatch(nav.safeNavigateUpPayload())
  const defaultCountry = Container.useSelector(s => s.settings.phoneNumbers.defaultCountry)

  const [emails, setEmails] = React.useState('')
  const {phoneNumbers, setPhoneNumber, addPhoneNumber, removePhoneNumber} = usePhoneNumberList()

  return (
    <Kb.Modal
      mode="DefaultFullHeight"
      onClose={onClose}
      header={{title: Styles.isMobile ? 'Invite friends' : 'Invite your friends to Keybase'}}
    >
      <Kb.Box2 direction="vertical" gap="small" style={styles.container}>
        <Kb.Icon type="icon-illustration-invite-friends-460-96" style={{width: '100%'}} />
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
                  key={pn.key}
                  defaultCountry={defaultCountry}
                  onChangeNumber={(phoneNumber, valid) => setPhoneNumber(i, phoneNumber, valid)}
                  onClear={phoneNumbers.length === 1 ? undefined : () => removePhoneNumber(i)}
                />
              ))}
              <Kb.Button mode="Secondary" icon="iconfont-new" onClick={addPhoneNumber} />
            </Kb.Box2>
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    backgroundColor: Styles.globalColors.blueGrey,
    flex: 1,
  },
  content: {
    ...Styles.padding(0, Styles.globalMargins.small, Styles.globalMargins.small),
  },
}))

export default InviteFriends
