import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useDeleteAccount} from '../use-delete-account'
import {usePasswordCheck} from '../use-password-check'

const CheckPassphraseImpl = () => {
  const styles = useStyles()
  const [password, setPassword] = React.useState('')
  const [showTyping, setShowTyping] = React.useState(false)
  const {checkPassword, checkPasswordIsCorrect} = usePasswordCheck()
  const deleteAccountForever = useDeleteAccount()
  const waitingKey = C.Waiting.useAnyWaiting(C.waitingKeySettingsGeneric)

  const onCheckPassword = checkPassword
  const deleteForever = () => {
    deleteAccountForever(password)
  }
  const keyboardType = showTyping && isAndroid ? 'visible-password' : 'default'

  return (
    <Kb.ModalScreen
      banner={
        checkPasswordIsCorrect === false ? (
          <Kb.Banner color="red">Wrong password. Please try again.</Kb.Banner>
        ) : checkPasswordIsCorrect === true ? (
          <Kb.Banner color="green">Your password is correct.</Kb.Banner>
        ) : undefined
      }
      footer={
        <Kb.WaitingButton
          fullWidth={true}
          waitingKey={C.waitingKeySettingsCheckPassword}
          disabled={!!checkPasswordIsCorrect || !password}
          label="Authorize"
          onClick={() => onCheckPassword(password)}
        />
      }
    >
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
        <Kb.Text center={true} type="BodyBig">
          Do you know your password?
        </Kb.Text>
        <Kb.Text center={true} type="Body">
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
        <Kb.Checkbox checked={showTyping} label="Show typing" onCheck={setShowTyping} />
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
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  deleteButton: {marginTop: Kb.Styles.globalMargins.large},
}))

const CheckPassphrase = isMobile ? CheckPassphraseImpl : () => null
export default CheckPassphrase
