// @flow
/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */
import * as LoginGen from '../../../actions/login-gen'
import React, {Component} from 'react'
import CodePage, {type Props} from '.'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'

// TODO remove this class
class _CodePage extends Component<Props, {enterText: string}> {
  state = {
    enterText: '',
  }

  onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      this.props.textEntered(this.state.enterText)
    }
  }

  render() {
    return (
      <CodePage
        enterText={this.state.enterText}
        onChangeText={enterText => this.setState({enterText})}
        onKeyDown={e => this.onKeyDown(e)}
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
    codePageCameraBrokenMode: cameraBrokenMode,
    codePageEnterCodeErrorText: enterCodeErrorText,
    codePageMode: mode,
    codePageMyDeviceRole: myDeviceRole,
    codePageOtherDeviceRole: otherDeviceRole,
    codePageQrCode: qrCode,
    codePageQrCodeScanned: qrCodeScanned,
    codePageTextCode: textCode,
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

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(LoginGen.createOnBack()),
  qrScanned: ({data}: {data: string}) => dispatch(LoginGen.createQrScanned({phrase: new HiddenString(data)})),
  resetQRCodeScanned: () => dispatch(LoginGen.createResetQRCodeScanned()),
  setCameraBrokenMode: (codePageCameraBrokenMode: boolean) =>
    dispatch(LoginGen.createSetCameraBrokenMode({codePageCameraBrokenMode})),
  setCodePageMode: codePageMode => dispatch(LoginGen.createSetCodePageMode({codePageMode})),
  textEntered: (phrase: string) =>
    dispatch(LoginGen.createProvisionTextCodeEntered({phrase: new HiddenString(phrase.trim())})),
})

export default connect(mapStateToProps, mapDispatchToProps)(_CodePage)
