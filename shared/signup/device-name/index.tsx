import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Platform from '../../constants/platform'
import {SignupScreen, errorBanner, InfoIcon} from '../common'

type Props = {
  error: string
  initialDevicename?: string
  onBack: () => void
  onContinue: (devicename: string) => void
  waiting: boolean
}

// Copied from go/libkb/checkers.go
const deviceRE = /^[a-zA-Z0-9][ _'a-zA-Z0-9+‘’—–-]*$/
// eslint-disable-next-line
const badDeviceRE = /  |[ '_-]$|['_-][ ]?['_-]/
const normalizeDeviceRE = /[^a-zA-Z0-9]/

const EnterDevicename = (props: Props) => {
  const [devicename, onChangeDevicename] = React.useState(props.initialDevicename || '')
  const disabled = React.useMemo(() => {
    const normalized = devicename.replace(normalizeDeviceRE, '')
    return (
      normalized.length < 3 ||
      normalized.length > 64 ||
      !deviceRE.test(devicename) ||
      badDeviceRE.test(devicename)
    )
  }, [devicename])
  const onContinue = () => (disabled ? {} : props.onContinue(devicename))
  return (
    <SignupScreen
      banners={errorBanner(props.error)}
      buttons={[{disabled, label: 'Continue', onClick: onContinue, type: 'Success', waiting: props.waiting}]}
      onBack={props.onBack}
      title={Styles.isMobile ? 'Name this phone' : 'Name this computer'}
    >
      <Kb.Box2
        alignItems="center"
        direction="vertical"
        gap={Styles.isMobile ? 'small' : 'medium'}
        fullWidth={true}
        style={Styles.globalStyles.flexOne}
      >
        <Kb.Icon
          type={
            Styles.isMobile
              ? Platform.isLargeScreen
                ? 'icon-phone-background-1-96'
                : 'icon-phone-background-1-64'
              : 'icon-computer-background-1-96'
          }
        />
        <Kb.Box2 direction="vertical" gap="tiny" style={styles.inputBox}>
          <Kb.LabeledInput
            autoFocus={true}
            containerStyle={styles.input}
            placeholder={Styles.isMobile ? 'Phone 1' : 'Computer 1'}
            onChangeText={onChangeDevicename}
            onEnterKeyDown={onContinue}
            value={devicename}
          />
          <Kb.Text type="BodySmall" style={styles.inputSub}>
            Your device name will be public and can not be changed in the future.
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}
EnterDevicename.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
  headerRightActions: () => (
    <Kb.Box2
      direction="horizontal"
      style={Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0)}
    >
      <InfoIcon />
    </Kb.Box2>
  ),
}

const styles = Styles.styleSheetCreate(() => ({
  input: Styles.platformStyles({
    isElectron: {
      width: 368,
    },
  }),
  inputBox: Styles.platformStyles({
    isElectron: {
      // need to set width so subtext will wrap
      width: 368,
    },
    isMobile: {
      width: '100%',
    },
  }),
  inputSub: {
    marginLeft: 2,
  },
}))

export default EnterDevicename
