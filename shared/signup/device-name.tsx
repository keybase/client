import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {SignupScreen, errorBanner} from './common'
import * as Provision from '@/stores/provision'
import {usePushState} from '@/stores/push'
import * as T from '@/constants/types'
import {RPCError} from '@/util/errors'
import {ignorePromise} from '@/constants/utils'
import * as Platforms from '@/constants/platform'
import logger from '@/logger'
import type {StaticScreenProps} from '@react-navigation/core'
import {
  clearSignupDeviceNameDraft,
  getSignupDeviceNameDraft,
  setSignupDeviceNameDraft,
} from './device-name-draft'

type Props = StaticScreenProps<{inviteCode?: string; username?: string}>

const ConnectedEnterDevicename = (p: Props) => {
  const showPermissionsPrompt = usePushState(s => s.dispatch.showPermissionsPrompt)
  const initialDevicename = getSignupDeviceNameDraft()
  const inviteCode = p.route.params.inviteCode ?? ''
  const username = p.route.params.username ?? ''
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeySignup)
  const {navigateAppend, navigateUp} = C.useRouterState(
    C.useShallow(s => ({
      navigateAppend: s.dispatch.navigateAppend,
      navigateUp: s.dispatch.navigateUp,
    }))
  )
  const [error, setError] = React.useState('')
  const onContinue = (devicename: string) => {
    setError('')
    setSignupDeviceNameDraft(devicename)
    const f = async () => {
      try {
        await T.RPCGen.deviceCheckDeviceNameFormatRpcPromise({name: devicename}, C.waitingKeySignup)
      } catch (error_) {
        if (error_ instanceof RPCError) {
          setError(error_.desc)
        }
        return
      }

      if (!username || !devicename) {
        logger.warn('Missing data during signup phase', username, devicename)
        return
      }

      try {
        showPermissionsPrompt?.({justSignedUp: true})
        await T.RPCGen.signupSignupRpcListener({
          customResponseIncomingCallMap: {
            'keybase.1.gpgUi.wantToAddGPGKey': (_, response) => {
              response.result(false)
            },
          },
          incomingCallMap: {
            'keybase.1.loginUi.displayPrimaryPaperKey': () => {},
          },
          params: {
            botToken: '',
            deviceName: devicename,
            deviceType: Platforms.isMobile ? T.RPCGen.DeviceType.mobile : T.RPCGen.DeviceType.desktop,
            email: '',
            genPGPBatch: false,
            genPaper: false,
            inviteCode,
            passphrase: '',
            randomPw: true,
            skipGPG: true,
            skipMail: true,
            storeSecret: true,
            username,
            verifyEmail: true,
          },
          waitingKey: C.waitingKeySignup,
        })
        clearSignupDeviceNameDraft()
      } catch (error_) {
        if (error_ instanceof RPCError) {
          showPermissionsPrompt?.({justSignedUp: false})
          navigateAppend({
            name: 'signupError',
            params: {errorCode: error_.code, errorMessage: error_.desc},
          })
        }
      }
    }
    ignorePromise(f())
  }

  const props = {
    error,
    initialDevicename,
    onBack: navigateUp,
    onContinue,
    waiting,
  }
  return <EnterDevicename {...props} />
}

export default ConnectedEnterDevicename

type EnterDevicenameProps = {
  error: string
  initialDevicename?: string
  onBack: () => void
  onContinue: (devicename: string) => void
  waiting: boolean
}

const makeCleanDeviceName = (d: string) => {
  let good = d.replace(Provision.badDeviceChars, '')
  good = Provision.cleanDeviceName(good)
  return good
}

const EnterDevicename = (props: EnterDevicenameProps) => {
  const [deviceName, setDeviceName] = React.useState(props.initialDevicename || '')
  const [readyToShowError, setReadyToShowError] = React.useState(false)
  const _setReadyToShowError = C.useDebouncedCallback((ready: boolean) => {
    setReadyToShowError(ready)
  }, 200)
  const cleanDeviceName = makeCleanDeviceName(deviceName)
  const normalized = cleanDeviceName.replace(Provision.normalizeDeviceRE, '')
  const disabled =
    normalized.length < 3 ||
    normalized.length > 64 ||
    !Provision.goodDeviceRE.test(cleanDeviceName) ||
    Provision.badDeviceRE.test(cleanDeviceName)
  const showDisabled = disabled && !!cleanDeviceName && readyToShowError
  const _setDeviceName = (deviceName: string) => {
    setDeviceName(deviceName)
    setReadyToShowError(false)
    _setReadyToShowError(true)
  }
  const onContinue = () => (disabled || props.waiting ? {} : props.onContinue(cleanDeviceName))

  React.useEffect(() => {
    if (cleanDeviceName !== deviceName) {
      setDeviceName(cleanDeviceName)
    }
  }, [deviceName, cleanDeviceName])

  return (
    <SignupScreen
      banners={errorBanner(props.error)}
      buttons={[{disabled, label: 'Continue', onClick: onContinue, type: 'Success', waiting: props.waiting}]}
      onBack={props.onBack}
      title={Kb.Styles.isMobile ? 'Name this device' : 'Name this computer'}
    >
      <Kb.Box2
        alignItems="center"
        direction="vertical"
        gap={Kb.Styles.isMobile ? 'small' : 'medium'}
        fullWidth={true}
        style={Kb.Styles.globalStyles.flexOne}
      >
        <Kb.ImageIcon
          type={
            Kb.Styles.isMobile
              ? C.isLargeScreen
                ? 'icon-phone-background-1-96'
                : 'icon-phone-background-1-64'
              : 'icon-computer-background-1-96'
          }
        />
        <Kb.Box2 direction="vertical" fullWidth={Kb.Styles.isPhone} gap="tiny">
          <Kb.Input3
            autoFocus={true}
            selectTextOnFocus={true}
            containerStyle={styles.input}
            error={showDisabled}
            maxLength={64}
            placeholder="Name"
            onChangeText={_setDeviceName}
            onEnterKeyDown={onContinue}
            value={deviceName}
          />
          {showDisabled ? (
            <Kb.Text type="BodySmall" style={styles.deviceNameError}>
              {Provision.deviceNameInstructions}
            </Kb.Text>
          ) : (
            <Kb.Text type="BodySmall">
              Your device name will be public and can not be changed in the future.
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}
const styles = Kb.Styles.styleSheetCreate(() => ({
  deviceNameError: {
    color: Kb.Styles.globalColors.redDark,
    marginLeft: 2,
  },
  input: Kb.Styles.platformStyles({
    isElectron: {width: 368},
    isTablet: {width: 368},
  }),
}))
