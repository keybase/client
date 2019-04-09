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
      <Kb.Text type="BodyTinySemibold" style={styles.headerText} center={true}>
        {props.phoneNumber}
      </Kb.Text>
    }
    containerStyle={styles.container}
    headerStyle={styles.container}
    header={
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.headerContainer}>
        <Kb.Text type="BodyBigLink" style={styles.backButton}>
          Back
        </Kb.Text>
        <Kb.Text type="BodyTinySemibold" style={styles.headerText} center={true}>
          {props.phoneNumber}
        </Kb.Text>
      </Kb.Box2>
    }
    negativeHeader={true}
    skipMobileHeader={true}
  >
    <Kb.Box2 direction="vertical" fullWidth={true} />
  </SignupScreen>
)

const styles = Styles.styleSheetCreate({
  backButton: {
    color: Styles.globalColors.white,
    padding: Styles.globalMargins.xsmall,
    paddingLeft: Styles.globalMargins.small,
  },
  container: {backgroundColor: Styles.globalColors.blue},
  headerContainer: {
    backgroundColor: Styles.globalColors.blue,
    position: 'relative',
  },
  headerText: Styles.platformStyles({
    common: {color: Styles.globalColors.darkBlue},
    isMobile: {
      left: 0,
      marginLeft: 'auto',
      marginRight: 'auto',
      position: 'absolute',
      right: 0,
    },
  }),
})

export default VerifyPhoneNumber
