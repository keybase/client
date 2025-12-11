import * as C from '@/constants'
import * as Devices from '@/constants/devices'
import {useSafeSubmit} from '@/util/safe-submit'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import debounce from 'lodash/debounce'
import {SignupScreen, errorBanner} from '../signup/common'
import {
  badDeviceChars,
  badDeviceRE,
  cleanDeviceName,
  deviceNameInstructions,
  goodDeviceRE,
  normalizeDeviceRE,
  useProvisionState,
} from '@/constants/provision'

const SetPublicName = () => {
  const devices = useProvisionState(s => s.devices)
  const error = useProvisionState(s => s.error)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyProvision)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const ponBack = useSafeSubmit(navigateUp, !!error)
  const psetDeviceName = useProvisionState(s => s.dispatch.dynamic.setDeviceName)
  const ponSubmit = React.useCallback(
    (name: string) => {
      !waiting && psetDeviceName?.(name)
    },
    [waiting, psetDeviceName]
  )
  const deviceNumbers = devices
    .filter(d => d.type === (C.isMobile ? 'mobile' : 'desktop'))
    .map(d => d.deviceNumberOfType)
  const maxDeviceNumber = deviceNumbers.length > 0 ? Math.max(...deviceNumbers) : -1
  const deviceIconNumber = ((maxDeviceNumber + 1) % Devices.numBackgrounds) + 1

  const [deviceName, setDeviceName] = React.useState(C.defaultDevicename)
  const [readyToShowError, setReadyToShowError] = React.useState(false)
  const debouncedSetReadyToShowError = debounce((ready: boolean) => setReadyToShowError(ready), 1000)
  const cleanDeviceNameValue = cleanDeviceName(deviceName)
  const normalized = cleanDeviceNameValue.replace(normalizeDeviceRE, '')
  const disabled =
    normalized.length < 3 ||
    normalized.length > 64 ||
    !goodDeviceRE.test(cleanDeviceNameValue) ||
    badDeviceRE.test(cleanDeviceNameValue)
  const showDisabled = disabled && !!cleanDeviceNameValue && readyToShowError
  const onSubmit = React.useCallback(() => {
    ponSubmit(cleanDeviceName(cleanDeviceNameValue))
  }, [cleanDeviceNameValue, ponSubmit])
  const _setDeviceName = (deviceName: string) => {
    setReadyToShowError(false)
    setDeviceName(deviceName.replace(badDeviceChars, ''))
    debouncedSetReadyToShowError(true)
  }

  const maybeIcon = Kb.Styles.isMobile
    ? C.isLargeScreen
      ? `icon-phone-background-${deviceIconNumber}-96`
      : `icon-phone-background-${deviceIconNumber}-64`
    : `icon-computer-background-${deviceIconNumber}-96`

  const defaultIcon = Kb.Styles.isMobile
    ? C.isLargeScreen
      ? `icon-phone-96`
      : `icon-phone-64`
    : `icon-computer-96`

  return (
    <SignupScreen
      banners={errorBanner(error)}
      buttons={[
        {
          disabled,
          label: 'Continue',
          onClick: onSubmit,
          type: 'Success',
          waiting: waiting,
        },
      ]}
      onBack={ponBack}
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
              {deviceNameInstructions}
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
  deviceNameError: {color: Kb.Styles.globalColors.redDark},
  nameInput: Kb.Styles.platformStyles({
    common: {padding: Kb.Styles.globalMargins.tiny},
    isMobile: {minHeight: 48},
    isTablet: {maxWidth: 368},
  }),
  wrapper: Kb.Styles.platformStyles({
    isElectron: {width: 400},
    isMobile: {width: '100%'},
  }),
}))

export default SetPublicName
