// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../common'

type Props = {|
  error: string,
  onBack: () => void,
  onChangeCode: string => void,
  onContinue: () => void,
  phoneNumber: string,
|}

const VerifyPhoneNumber = (props: Props) => (
  <SignupScreen
    onBack={props.onBack}
    banners={props.error ? [<Kb.Banner key="error" color="red" text={props.error} />] : []}
    buttons={[{label: 'Continue', onClick: props.onContinue, type: 'PrimaryGreen'}]}
    titleComponent={
      <Kb.Text type="BodyTiny" style={styles.headerText} center={true}>
        {props.phoneNumber}
      </Kb.Text>
    }
    containerStyle={styles.container}
    headerStyle={styles.container}
    borderless={true}
    theme="dark"
  >
    <Kb.Box2 direction="vertical" gap="tiny" gapStart={Styles.isMobile} />
  </SignupScreen>
)

const styles = Styles.styleSheetCreate({
  container: {backgroundColor: Styles.globalColors.blue},
  headerText: {color: Styles.globalColors.darkBlue},
})

export default VerifyPhoneNumber
