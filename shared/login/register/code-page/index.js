// @flow
/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */
import React, {Component} from 'react'
import RenderCodePage from './index.render'
import type {Props} from './index.render'
import {connect} from 'react-redux'

class CodePage extends Component<void, Props, {enterText: string}> {
  state = {
    enterText: '',
  }

  render () {
    return (
      <RenderCodePage
        enterText={this.state.enterText}
        onChangeText={enterText => this.setState({enterText})}
        onBack={this.props.onBack}
        mode={this.props.mode}
        textCode={this.props.textCode}
        qrCode={this.props.qrCode}
        myDeviceRole={this.props.myDeviceRole}
        otherDeviceRole={this.props.otherDeviceRole}
        cameraBrokenMode={this.props.cameraBrokenMode}
        setCodePageMode={this.props.setCodePageMode}
        qrScanned={this.props.qrScanned}
        setCameraBrokenMode={this.props.setCameraBrokenMode}
        textEntered={() => this.props.textEntered(this.state.enterText)}
        doneRegistering={this.props.doneRegistering}
      />
    )
  }
}

export default connect(
  (state: any, {routeProps}) => ({
    ...routeProps.mapStateToProps(state),
    ...routeProps,
  })
)(CodePage)
