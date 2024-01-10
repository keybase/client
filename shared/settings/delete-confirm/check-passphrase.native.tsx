import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Container from '@/util/container'

const CheckPassphraseMobile = () => {
  const [password, setPassword] = React.useState('')
  const [showTyping, setShowTyping] = React.useState(false)

  const checkPasswordIsCorrect = C.useSettingsState(s => s.checkPasswordIsCorrect)
  const nav = Container.useSafeNavigation()
  const checkPassword = C.useSettingsState(s => s.dispatch.checkPassword)
  const resetCheckPassword = C.useSettingsState(s => s.dispatch.resetCheckPassword)
  const deleteAccountForever = C.useSettingsState(s => s.dispatch.deleteAccountForever)

  const onCancel = () => {
    resetCheckPassword()
    nav.safeNavigateUp()
  }
  const onCheckPassword = checkPassword
  const deleteForever = () => {
    deleteAccountForever(password)
  }

  const waitingKey = C.Waiting.useAnyWaiting(C.Settings.settingsWaitingKey)
  const inputType = showTyping ? 'text' : 'password'
  const keyboardType = showTyping && Kb.Styles.isAndroid ? 'visible-password' : 'default'

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
              waitingKey={C.Settings.checkPasswordWaitingKey}
              disabled={!!checkPasswordIsCorrect || !password}
              label="Authorize"
              onClick={() => onCheckPassword(password)}
            />
          </Kb.ButtonBar>
        ),
      }}
      header={{
        leftButton: Kb.Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onCancel}>
            Cancel
          </Kb.Text>
        ) : null,
      }}
      onClose={onCancel}
    >
      <Kb.Box2 direction="vertical" fullHeight={true} style={styles.container}>
        {Kb.Styles.isMobile && (
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bodyText: {
        paddingBottom: Kb.Styles.globalMargins.tiny,
        textAlign: 'center',
      },
      buttonBar: {
        minHeight: undefined,
      },
      checkbox: {
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      container: {
        ...Kb.Styles.padding(
          Kb.Styles.globalMargins.medium,
          Kb.Styles.globalMargins.small,
          Kb.Styles.globalMargins.medium,
          Kb.Styles.globalMargins.small
        ),
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        flexGrow: 1,
      },
      deleteButton: {
        marginTop: Kb.Styles.globalMargins.large,
      },
      headerText: {
        marginBottom: Kb.Styles.globalMargins.small,
        textAlign: 'center',
      },
    }) as const
)

export default CheckPassphraseMobile
