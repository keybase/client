import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/settings'
import * as Container from '../../util/container'
import * as SettingsGen from '../../actions/settings-gen'
import HiddenString from '../../util/hidden-string'

const CheckPassphraseMobile = () => {
  const [password, setPassword] = React.useState('')
  const [showTyping, setShowTyping] = React.useState(false)

  const checkPasswordIsCorrect = Container.useSelector(state => state.settings.checkPasswordIsCorrect)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const onCancel = () => {
    dispatch(SettingsGen.createResetCheckPasswordIsCorrect())
    dispatch(nav.safeNavigateUpPayload())
  }
  const onCheckPassword = (password: string) => {
    if (password) {
      dispatch(SettingsGen.createCheckPassword({password: new HiddenString(password)}))
    }
  }
  const deleteForever = () =>
    dispatch(SettingsGen.createDeleteAccountForever({passphrase: new HiddenString(password)}))

  const waitingKey = Container.useAnyWaiting(Constants.settingsWaitingKey)
  const inputType = showTyping ? 'text' : 'password'
  const keyboardType = showTyping && Styles.isAndroid ? 'visible-password' : 'default'

  return (
    <Kb.Modal
      banners={
        <>
          {checkPasswordIsCorrect === false ? (
            <Kb.Banner key="errorBanner" color="red">
              Wrong password. Please try again.
            </Kb.Banner>
          ) : null}
          {checkPasswordIsCorrect === true ? (
            <Kb.Banner key="successBanner" color="green">
              Your password is correct.
            </Kb.Banner>
          ) : null}
        </>
      }
      footer={{
        content: (
          <Kb.ButtonBar align="center" direction="column" fullWidth={true} style={styles.buttonBar}>
            <Kb.WaitingButton
              fullWidth={true}
              waitingKey={Constants.checkPasswordWaitingKey}
              disabled={!!checkPasswordIsCorrect || !password}
              label="Authorize"
              onClick={() => onCheckPassword(password)}
            />
          </Kb.ButtonBar>
        ),
      }}
      header={{
        leftButton: Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onCancel}>
            Cancel
          </Kb.Text>
        ) : null,
      }}
      onClose={onCancel}
    >
      <Kb.Box2 direction="vertical" fullHeight={true} style={styles.container}>
        {Styles.isMobile && (
          <Kb.Text style={styles.headerText} type="Header">
            Do you know your password?
          </Kb.Text>
        )}
        <Kb.Text style={styles.bodyText} type="Body">
          You will need it to delete this account.
        </Kb.Text>
        <Kb.RoundedBox>
          <Kb.PlainInput
            keyboardType={keyboardType}
            onEnterKeyDown={() => onCheckPassword(password)}
            onChangeText={password => setPassword(password)}
            placeholder="Your password"
            type={inputType}
            value={password}
          />
        </Kb.RoundedBox>
        <Kb.Checkbox
          checked={showTyping}
          label="Show typing"
          onCheck={setShowTyping}
          style={styles.checkbox}
        />
        {checkPasswordIsCorrect && (
          <Kb.Button
            label="Delete forever"
            onClick={deleteForever}
            type="Danger"
            style={styles.deleteButton}
            waiting={waitingKey}
          />
        )}
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      bodyText: {
        paddingBottom: Styles.globalMargins.tiny,
        textAlign: 'center',
      },
      buttonBar: {
        minHeight: undefined,
      },
      checkbox: {
        paddingTop: Styles.globalMargins.tiny,
      },
      container: {
        ...Styles.padding(
          Styles.globalMargins.medium,
          Styles.globalMargins.small,
          Styles.globalMargins.medium,
          Styles.globalMargins.small
        ),
        backgroundColor: Styles.globalColors.blueGrey,
        flexGrow: 1,
      },
      deleteButton: {
        marginTop: Styles.globalMargins.large,
      },
      headerText: {
        marginBottom: Styles.globalMargins.small,
        textAlign: 'center',
      },
    } as const)
)

export default CheckPassphraseMobile
