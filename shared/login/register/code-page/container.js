// @flow
/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */
import React, {Component} from 'react'
import CodePage from '.'
import * as Creators from '../../../actions/login/creators'
import {connect} from 'react-redux'

import type {Props} from '.'
import type {TypedState} from '../../../constants/reducer'

// TODO remove this class
class _CodePage extends Component<void, Props, {enterText: string}> {
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
  onBack: () => dispatch(Creators.onBack()),
  setCodePageMode: requestedMode => dispatch(Creators.setCodePageMode(requestedMode)),
  setCameraBrokenMode: (broken: boolean) => dispatch(Creators.setCameraBrokenMode(broken)),
  qrScanned: ({data}) => dispatch(Creators.qrScanned(data)),
  textEntered: text => dispatch(Creators.provisionTextCodeEntered(text)),
})

// $FlowIssue
export default connect(mapStateToProps, mapDispatchToProps)(_CodePage)
