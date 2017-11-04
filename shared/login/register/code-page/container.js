// @flow
/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */
import * as LoginGen from '../../../actions/login-gen'
import React, {Component} from 'react'
import CodePage, {type Props} from '.'
import {connect, type TypedState} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'

// TODO remove this class
class _CodePage extends Component<Props, {enterText: string}> {
  state = {
    enterText: '',
  }

  render() {
    return (
      <CodePage
        enterText={this.state.enterText}
        onChangeText={enterText => this.setState({enterText})}
        onBack={this.props.onBack}
        mode={this.props.mode}
        textCode={this.props.textCode}
        qrCode={this.props.qrCode}
        qrCodeScanned={this.props.qrCodeScanned}
        myDeviceRole={this.props.myDeviceRole}
        otherDeviceRole={this.props.otherDeviceRole}
        cameraBrokenMode={this.props.cameraBrokenMode}
        setCodePageMode={this.props.setCodePageMode}
        qrScanned={this.props.qrScanned}
        resetQRCodeScanned={this.props.resetQRCodeScanned}
        setCameraBrokenMode={this.props.setCameraBrokenMode}
        enterCodeErrorText={this.props.enterCodeErrorText}
        textEntered={() => this.props.textEntered(this.state.enterText)}
      />
    )
  }
}

const mapStateToProps = ({
  login: {
    codePage: {
      cameraBrokenMode,
      enterCodeErrorText,
      mode,
      myDeviceRole,
      otherDeviceRole,
      qrCode,
      qrCodeScanned,
      textCode,
    },
  },
}: TypedState) => ({
  cameraBrokenMode,
  enterCodeErrorText,
  mode,
  myDeviceRole,
  otherDeviceRole,
  qrCode: qrCode ? qrCode.stringValue() : '',
  qrCodeScanned,
  textCode: textCode ? textCode.stringValue() : '',
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(LoginGen.createOnBack()),
  setCodePageMode: mode => dispatch(LoginGen.createSetCodePageMode({mode})),
  setCameraBrokenMode: (broken: boolean) => dispatch(LoginGen.createSetCameraBrokenMode({broken})),
  qrScanned: ({data}) => dispatch(LoginGen.createQrScanned({phrase: new HiddenString(data)})),
  resetQRCodeScanned: () => dispatch(LoginGen.createResetQRCodeScanned()),
  textEntered: phrase => dispatch(LoginGen.createProvisionTextCodeEntered({phrase})),
})

export default connect(mapStateToProps, mapDispatchToProps)(_CodePage)
