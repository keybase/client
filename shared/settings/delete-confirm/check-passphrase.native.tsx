import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useSettingsState} from '@/stores/settings'

const CheckPassphraseMobile = () => {
  const [password, setPassword] = React.useState('')
  const [showTyping, setShowTyping] = React.useState(false)

  const checkPasswordIsCorrect = useSettingsState(s => s.checkPasswordIsCorrect)
  const nav = useSafeNavigation()
  const checkPassword = useSettingsState(s => s.dispatch.checkPassword)
  const resetCheckPassword = useSettingsState(s => s.dispatch.resetCheckPassword)
  const deleteAccountForever = useSettingsState(s => s.dispatch.deleteAccountForever)

  const onCancel = () => {
    resetCheckPassword()
    nav.safeNavigateUp()
  }
  const onCheckPassword = checkPassword
  const deleteForever = () => {
    deleteAccountForever(password)
  }

  const waitingKey = C.Waiting.useAnyWaiting(C.waitingKeySettingsGeneric)
  const keyboardType = showTyping && Kb.Styles.isAndroid ? 'visible-password' : 'default'

  return (
    <>
      <Kb.ModalHeader
        leftButton={
          <Kb.Text type="BodyBigLink" onClick={onCancel}>
            Cancel
          </Kb.Text>
        }
      />
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
      <Kb.Box2 direction="vertical" fullHeight={true} flex={1} style={styles.container}>
        <Kb.Text style={styles.headerText} type="Header">
          Do you know your password?
        </Kb.Text>
        <Kb.Text style={styles.bodyText} type="Body">
          You will need it to delete this account.
        </Kb.Text>
        <Kb.RoundedBox>
          <Kb.Input3
            keyboardType={keyboardType}
            onEnterKeyDown={() => onCheckPassword(password)}
            onChangeText={(password: string) => setPassword(password)}
            placeholder="Your password"
            secureTextEntry={!showTyping}
            value={password}
            hideBorder={true}
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
      <Kb.ModalFooter
        content={
          <Kb.ButtonBar align="center" direction="column" fullWidth={true} style={styles.buttonBar}>
            <Kb.WaitingButton
              fullWidth={true}
              waitingKey={C.waitingKeySettingsCheckPassword}
              disabled={!!checkPasswordIsCorrect || !password}
              label="Authorize"
              onClick={() => onCheckPassword(password)}
            />
          </Kb.ButtonBar>
        }
      />
    </>
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
