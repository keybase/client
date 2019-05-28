import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../common'

type Props = {
  onBack: () => void
  onChangeDevicename: () => void
  onContinue: () => void
}

const EnterDevicename = (props: Props) => (
  <SignupScreen
    buttons={[{label: 'Continue', onClick: props.onContinue, type: 'Success'}]}
    onBack={props.onBack}
    title={Styles.isMobile ? 'Name this phone' : 'Name this computer'}
  >
    <Kb.Box2
      alignItems="center"
      direction="vertical"
      gap={Styles.isMobile ? 'small' : 'medium'}
      fullWidth={true}
      style={styles.flexOne}
    >
      <Kb.Icon type={Styles.isMobile ? 'icon-phone-96' : 'icon-computer-96'} />
      <Kb.Box2 direction="vertical" gap="tiny" style={styles.inputBox}>
        <Kb.NewInput
          autoFocus={true}
          containerStyle={styles.input}
          placeholder={Styles.isMobile ? 'Phone 1' : 'Computer 1'}
          onChangeText={props.onChangeDevicename}
        />
        <Kb.Text type="BodySmall" style={styles.inputSub}>
          Your device name will be public and can not be changed in the future.
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  </SignupScreen>
)

const styles = Styles.styleSheetCreate({
  flexOne: {
    flex: 1,
  },
  input: Styles.platformStyles({
    common: {},
    isElectron: {
      ...Styles.padding(0, Styles.globalMargins.xsmall),
      height: 38,
      width: 368,
    },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.small),
      height: 48,
    },
  }),
  inputBox: Styles.platformStyles({
    isElectron: {
      // need to set width so subtext will wrap
      width: 368,
    },
  }),
  inputSub: {
    marginLeft: 2,
  },
})

export default EnterDevicename
