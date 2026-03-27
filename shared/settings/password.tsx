import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import * as T from '@/constants/types'
import {useRequestLogout} from './use-request-logout'
import {usePWState} from '@/stores/settings-password'

type Props = {
  error: string
  hasPGPKeyOnServer?: boolean
  onSave: (password: string) => void // will only be called if password.length > 8 & passwords match
  saveLabel?: string
  showTyping?: boolean
  waitingForResponse?: boolean
}

export const UpdatePassword = (props: Props) => {
  const [password, setPassword] = React.useState('')
  const [passwordConfirm, setPasswordConfirm] = React.useState('')
  const [showTyping, setShowTyping] = React.useState(!!props.showTyping)
  const [errorSaving, setErrorSaving] = React.useState('')

  const handlePasswordChange = (password: string) => {
    setPassword(password)
    setErrorSaving(errorSavingFunc(password, passwordConfirm))
  }

  const handlePasswordConfirmChange = (passwordConfirm: string) => {
    setPasswordConfirm(passwordConfirm)
    setErrorSaving(errorSavingFunc(password, passwordConfirm))
  }

  const errorSavingFunc = (password: string, passwordConfirm: string): string => {
    if (password && passwordConfirm && password !== passwordConfirm) {
      return 'Passwords must match.'
    }
    return ''
  }

  const canSubmit = () => !errorSaving && password.length >= 8 && password === passwordConfirm

  const keyboardType = showTyping && Kb.Styles.isAndroid ? 'visible-password' : 'default'
  const notification = props.error
    ? props.error
    : props.hasPGPKeyOnServer
      ? "Changing your password will delete your PGP key from Keybase, and you'll need to generate or upload one again."
      : null

  const hintType = errorSaving
    ? 'BodySmallError'
    : password.length >= 8 && passwordConfirm.length >= 8
      ? 'BodySmallSuccess'
      : 'BodySmall'
  const hintText = errorSaving ? (
    errorSaving
  ) : password.length >= 8 && passwordConfirm.length >= 8 ? (
    <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.passwordFormat}>
      <Kb.Icon type="iconfont-check" color={Kb.Styles.globalColors.green} sizeType="Small" />
      <Kb.Text type="BodySmallSuccess">Passwords match.</Kb.Text>
    </Kb.Box2>
  ) : (
    'Password must be at least 8 characters.'
  )

  return (
    <>
      {notification ? (
        <Kb.Banner color="yellow">
          <Kb.BannerParagraph bannerColor="yellow" content={notification} />
        </Kb.Banner>
      ) : null}
      <Kb.ScrollView alwaysBounceVertical={false} style={Kb.Styles.globalStyles.flexOne}>
        <Kb.Box2
          centerChildren={!Kb.Styles.isTablet}
          direction="vertical"
          fullHeight={true}
          flex={1}
          style={styles.container}
        >
          <Kb.Text type="Body" style={styles.bodyText} center={true}>
            A password is required for you to sign out and sign back in.
          </Kb.Text>
          <Kb.RoundedBox side="top">
            <Kb.Input3
              placeholder="New password"
              secureTextEntry={!showTyping}
              keyboardType={keyboardType}
              value={password}
              onChangeText={handlePasswordChange}
              hideBorder={true}
            />
          </Kb.RoundedBox>
          <Kb.RoundedBox side="bottom">
            <Kb.Input3
              placeholder="Confirm password"
              secureTextEntry={!showTyping}
              keyboardType={keyboardType}
              value={passwordConfirm}
              onChangeText={handlePasswordConfirmChange}
              onEnterKeyDown={() => {
                if (canSubmit()) {
                  props.onSave(password)
                }
              }}
              hideBorder={true}
            />
          </Kb.RoundedBox>
          {typeof hintText === 'string' ? (
            <Kb.Text style={styles.passwordFormat} type={hintType}>
              {hintText}
            </Kb.Text>
          ) : (
            hintText
          )}
          <Kb.Checkbox
            label="Show typing"
            onCheck={() => setShowTyping(s => !s)}
            checked={showTyping || !!props.showTyping}
            style={styles.checkbox}
          />
        </Kb.Box2>
      </Kb.ScrollView>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
          <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
            <Kb.Button
              fullWidth={true}
              label={props.saveLabel || 'Save'}
              disabled={!canSubmit()}
              onClick={() => props.onSave(password)}
              waiting={props.waitingForResponse}
            />
          </Kb.ButtonBar>
      </Kb.Box2>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bodyText: {
        paddingBottom: Kb.Styles.globalMargins.small,
      },
      buttonBar: {
        minHeight: undefined,
      },
      checkbox: {
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingRight: Kb.Styles.globalMargins.small,
        paddingTop: Kb.Styles.globalMargins.small,
        width: '100%',
      },
      container: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        padding: Kb.Styles.globalMargins.small,
      },
      modalFooter: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
          borderStyle: 'solid' as const,
          borderTopColor: Kb.Styles.globalColors.black_10,
          borderTopWidth: 1,
          minHeight: 56,
        },
        isElectron: {
          borderBottomLeftRadius: Kb.Styles.borderRadius,
          borderBottomRightRadius: Kb.Styles.borderRadius,
          overflow: 'hidden',
        },
      }),
      passwordFormat: {
        alignSelf: 'flex-start',
        marginTop: Kb.Styles.globalMargins.xtiny,
      },
    }) as const
)

export const useSubmitNewPassword = (thenLogout: boolean) => {
  const [error, setError] = React.useState('')
  const waitingForResponse = C.Waiting.useAnyWaiting(C.waitingKeySettingsGeneric)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const requestLogout = useRequestLogout()
  const submitNewPassword = C.useRPC(T.RPCGen.accountPassphraseChangeRpcPromise)

  const onSave = (password: string) => {
    setError('')
    submitNewPassword(
      [
        {
          force: true,
          oldPassphrase: '',
          passphrase: password,
        },
        C.waitingKeySettingsGeneric,
      ],
      () => {
        if (thenLogout) {
          requestLogout()
        }
        navigateUp()
      },
      err => {
        setError(err.desc)
      }
    )
  }

  return {error, onSave, waitingForResponse}
}

const Container = () => {
  const randomPW = usePWState(s => s.randomPW)
  const saveLabel = randomPW ? 'Create password' : 'Save'
  const {error, onSave, waitingForResponse} = useSubmitNewPassword(false)

  const [hasPGPKeyOnServer, setHasPGPKeyOnServer] = React.useState<boolean | undefined>(undefined)
  const loadPgpSettings = C.useRPC(T.RPCGen.accountHasServerKeysRpcPromise)
  React.useEffect(() => {
    loadPgpSettings(
      [undefined],
      ({hasServerKeys}) => {
        setHasPGPKeyOnServer(hasServerKeys)
      },
      () => {}
    )
  }, [loadPgpSettings])

  const props = {
    error,
    hasPGPKeyOnServer,
    onSave,
    saveLabel,
    waitingForResponse,
  }
  return <UpdatePassword {...props} />
}

export default Container
