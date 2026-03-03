import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {SignupScreen, errorBanner} from './common'
import * as Provision from '@/stores/provision'
import {useSignupState} from '@/stores/signup'

const ConnectedEnterDevicename = () => {
  const error = useSignupState(s => s.devicenameError)
  const initialDevicename = useSignupState(s => s.devicename)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyProvision)
  const goBackAndClearErrors = useSignupState(s => s.dispatch.goBackAndClearErrors)
  const checkDeviceName = useSignupState(s => s.dispatch.checkDeviceName)
  const onBack = goBackAndClearErrors
  const onContinue = checkDeviceName
  const props = {
    error,
    initialDevicename,
    onBack,
    onContinue,
    waiting,
  }
  return <EnterDevicename {...props} />
}

export default ConnectedEnterDevicename

type Props = {
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

const EnterDevicename = (props: Props) => {
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
  const onContinue = () => (disabled ? {} : props.onContinue(cleanDeviceName))

  const inputRef = React.useRef<Kb.PlainInputRef>(null)
  C.useOnMountOnce(() => {
    inputRef.current?.transformText(i => {
      if (!props.initialDevicename) return i
      return {
        selection: {
          end: props.initialDevicename.length,
          start: 0,
        },
        text: props.initialDevicename,
      }
    })
  })

  React.useEffect(() => {
    if (cleanDeviceName !== deviceName) {
      inputRef.current?.transformText(() => {
        return {
          selection: {
            end: cleanDeviceName.length,
            start: cleanDeviceName.length,
          },
          text: cleanDeviceName,
        }
      })
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
        <Kb.Icon
          type={
            Kb.Styles.isMobile
              ? C.isLargeScreen
                ? 'icon-phone-background-1-96'
                : 'icon-phone-background-1-64'
              : 'icon-computer-background-1-96'
          }
        />
        <Kb.Box2 direction="vertical" fullWidth={Kb.Styles.isPhone} gap="tiny">
          <Kb.LabeledInput
            ref={inputRef}
            autoFocus={true}
            containerStyle={styles.input}
            error={showDisabled}
            maxLength={64}
            placeholder="Name"
            hoverPlaceholder={Kb.Styles.isMobile ? 'Phone 1' : 'Computer 1'}
            onChangeText={_setDeviceName}
            onEnterKeyDown={onContinue}
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
