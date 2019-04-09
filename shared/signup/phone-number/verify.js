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

class VerifyPhoneNumber extends React.Component<Props, {value: string}> {
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
        buttons={[{label: 'Continue', onClick: this.props.onContinue, type: 'PrimaryGreen'}]}
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
          >
            <Kb.Text type="Header" style={styles.inputText}>
              {this.state.value}
            </Kb.Text>
          </Kb.PlainInput>
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
  input: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.darkBlue2,
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
})

export default VerifyPhoneNumber
