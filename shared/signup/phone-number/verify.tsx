import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../common'

type Props = {
  error: string
  onBack: () => void
  onChangeCode: (code: string) => void
  onContinue: () => void
  onResend: () => void
  phoneNumber: string
  resendWaiting: boolean
}

class VerifyPhoneNumber extends React.Component<
  Props,
  {
    value: string
  }
> {
  state = {value: ''}
  _onChangeText = value => {
    this.props.onChangeCode(value)
    this.setState({value})
  }
  render() {
    return (
      <SignupScreen
        onBack={this.props.onBack}
        banners={this.props.error ? [<Kb.Banner key="error" color="red" text={this.props.error} />] : []}
        buttons={[{label: 'Continue', onClick: this.props.onContinue, type: 'Success'}]}
        titleComponent={
          <Kb.Text type="BodyTinySemibold" style={styles.headerText} center={true}>
            {this.props.phoneNumber}
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
              {this.props.phoneNumber}
            </Kb.Text>
          </Kb.Box2>
        }
        negativeHeader={true}
        skipMobileHeader={true}
      >
        <Kb.Box2 alignItems="center" direction="vertical" fullWidth={true} gap="small" style={styles.body}>
          <Kb.Text type="Body" negative={true} center={true}>
            Enter the code in the SMS you received:
          </Kb.Text>
          <Kb.PlainInput
            autoFocus={true}
            style={styles.input}
            flexable={true}
            keyboardType="numeric"
            onChangeText={this._onChangeText}
            maxLength={5}
            textType="Header"
            textContentType="oneTimeCode"
          >
            <Kb.Text type="Header" style={styles.inputText}>
              {/* We put this child in Input because some text styles don't work on input itself - the one we need here is letterSpacing */}
              {this.state.value}
            </Kb.Text>
          </Kb.PlainInput>
          <Kb.ClickableBox onClick={this.props.onResend} style={styles.positionRelative}>
            <Kb.Box2
              alignItems="center"
              direction="horizontal"
              gap="tiny"
              style={Styles.collapseStyles([styles.resend, this.props.resendWaiting && styles.opacity30])}
            >
              <Kb.Icon
                type="iconfont-reload"
                color={Styles.globalColors.white}
                style={styles.iconVerticalAlign}
              />
              <Kb.Text type="BodySemibold" negative={true}>
                Resend SMS
              </Kb.Text>
            </Kb.Box2>
            {this.props.resendWaiting && (
              <Kb.Box2 direction="horizontal" style={styles.progressContainer} centerChildren={true}>
                <Kb.ProgressIndicator type="Small" white={true} />
              </Kb.Box2>
            )}
          </Kb.ClickableBox>
        </Kb.Box2>
      </SignupScreen>
    )
  }
}

const styles = Styles.styleSheetCreate({
  backButton: {
    color: Styles.globalColors.white,
    padding: Styles.globalMargins.xsmall,
    paddingLeft: Styles.globalMargins.small,
  },
  body: Styles.platformStyles({
    isMobile: {
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
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
  iconVerticalAlign: Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: 1,
    },
  }),
  input: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blueDark,
      borderRadius: Styles.borderRadius,
      color: Styles.globalColors.white,
      letterSpacing: 20,
      textAlign: 'center',
    },
    isElectron: {
      ...Styles.padding(0, Styles.globalMargins.xsmall),
      height: 38,
      width: 368,
    },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.small),
      minHeight: 48,
      width: '100%',
    },
  }),
  inputText: Styles.platformStyles({
    isMobile: {
      color: Styles.globalColors.white,
      letterSpacing: 20,
      lineHeight: 28, // arrived at by fiddling - doesn't affect android
    },
  }),
  opacity30: {opacity: 0.3},
  positionRelative: {position: 'relative'},
  progressContainer: Styles.platformStyles({
    common: {...Styles.globalStyles.fillAbsolute},
    isElectron: {paddingTop: Styles.globalMargins.tiny},
  }),
  resend: Styles.platformStyles({
    isElectron: {
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
})

export default VerifyPhoneNumber
