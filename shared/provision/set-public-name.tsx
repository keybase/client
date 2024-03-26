import * as C from '@/constants'
import * as Constants from '@/constants/provision'
import * as Container from '@/util/container'
import * as Devices from '@/constants/devices'
import * as Kb from '@/common-adapters'
import * as Platform from '@/constants/platform'
import * as React from 'react'
import debounce from 'lodash/debounce'
import {SignupScreen, errorBanner} from '../signup/common'

const PublicNameContainer = () => {
  const devices = C.useProvisionState(s => s.devices)
  const error = C.useProvisionState(s => s.error)
  const waiting = C.Waiting.useAnyWaiting(C.Provision.waitingKey)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const _onBack = navigateUp
  const onBack = Container.useSafeSubmit(_onBack, !!error)
  const setDeviceName = C.useProvisionState(s => s.dispatch.dynamic.setDeviceName)
  const onSubmit = React.useCallback(
    (name: string) => {
      !waiting && setDeviceName?.(name)
    },
    [waiting, setDeviceName]
  )
  const deviceNumbers = devices
    .filter(d => d.type === (Platform.isMobile ? 'mobile' : 'desktop'))
    .map(d => d.deviceNumberOfType)
  const maxDeviceNumber = deviceNumbers.length > 0 ? Math.max(...deviceNumbers) : -1
  const deviceIconNumber = ((maxDeviceNumber + 1) % Devices.numBackgrounds) + 1

  return (
    <SetPublicName
      onBack={onBack}
      onSubmit={onSubmit}
      deviceIconNumber={deviceIconNumber}
      error={error}
      waiting={waiting}
    />
  )
}
export default PublicNameContainer

type Props = {
  onBack: () => void
  onSubmit: (name: string) => void
  deviceIconNumber: number
  error: string
  waiting: boolean
}

const SetPublicName = (props: Props) => {
  const [deviceName, setDeviceName] = React.useState(C.Signup.defaultDevicename)
  const [readyToShowError, setReadyToShowError] = React.useState(false)
  const debouncedSetReadyToShowError = debounce((ready: boolean) => setReadyToShowError(ready), 1000)
  const cleanDeviceName = Constants.cleanDeviceName(deviceName)
  const normalized = cleanDeviceName.replace(Constants.normalizeDeviceRE, '')
  const disabled =
    normalized.length < 3 ||
    normalized.length > 64 ||
    !Constants.goodDeviceRE.test(cleanDeviceName) ||
    Constants.badDeviceRE.test(cleanDeviceName)
  const showDisabled = disabled && !!cleanDeviceName && readyToShowError
  const _onSubmit = props.onSubmit
  const onSubmit = React.useCallback(() => {
    _onSubmit(Constants.cleanDeviceName(cleanDeviceName))
  }, [cleanDeviceName, _onSubmit])
  const _setDeviceName = (deviceName: string) => {
    setReadyToShowError(false)
    setDeviceName(deviceName.replace(Constants.badDeviceChars, ''))
    debouncedSetReadyToShowError(true)
  }

  const maybeIcon = Kb.Styles.isMobile
    ? Platform.isLargeScreen
      ? `icon-phone-background-${props.deviceIconNumber}-96`
      : `icon-phone-background-${props.deviceIconNumber}-64`
    : `icon-computer-background-${props.deviceIconNumber}-96`

  const defaultIcon = Kb.Styles.isMobile
    ? Platform.isLargeScreen
      ? `icon-phone-96`
      : `icon-phone-64`
    : `icon-computer-96`

  return (
    <SignupScreen
      banners={errorBanner(props.error)}
      buttons={[
        {
          disabled,
          label: 'Continue',
          onClick: onSubmit,
          type: 'Success',
          waiting: props.waiting,
        },
      ]}
      onBack={props.onBack}
      title={Kb.Styles.isMobile ? 'Name this device' : 'Name this computer'}
    >
      <Kb.Box2 direction="vertical" style={styles.contents} centerChildren={true} gap="medium">
        <Kb.Icon type={Kb.isValidIconType(maybeIcon) ? maybeIcon : defaultIcon} />
        <Kb.Box2 direction="vertical" style={styles.wrapper} gap="xsmall">
          <Kb.NewInput
            autoFocus={true}
            error={showDisabled}
            maxLength={64}
            placeholder="Pick a device name"
            onEnterKeyDown={onSubmit}
            onChangeText={_setDeviceName}
            value={cleanDeviceName}
            style={styles.nameInput}
          />
          {showDisabled ? (
            <Kb.Text type="BodySmall" style={styles.deviceNameError}>
              {Constants.deviceNameInstructions}
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
  backButton: Kb.Styles.platformStyles({
    isElectron: {
      marginLeft: Kb.Styles.globalMargins.medium,
      marginTop: Kb.Styles.globalMargins.medium,
    },
    isMobile: {
      marginLeft: 0,
      marginTop: 0,
    },
  }),
  contents: Kb.Styles.platformStyles({
    common: {width: '100%'},
    isTablet: {width: undefined},
  }),
  deviceNameError: {
    color: Kb.Styles.globalColors.redDark,
  },
  nameInput: Kb.Styles.platformStyles({
    common: {
      padding: Kb.Styles.globalMargins.tiny,
    },
    isMobile: {
      minHeight: 48,
    },
    isTablet: {
      maxWidth: 368,
    },
  }),
  wrapper: Kb.Styles.platformStyles({
    isElectron: {
      width: 400,
    },
    isMobile: {
      width: '100%',
    },
  }),
}))
