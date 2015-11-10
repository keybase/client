'use strict'
/* @flow */

import React, {Component} from '../../base-react'
import commonStyles from '../../styles/common'

export default class RegisterRender extends Component {
  render () {
    return (
      <div style={{display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
        <p>Register</p>
        <p style={commonStyles.clickable} onClick={() => { this.props.gotoExistingDevicePage() }}>Use an existing device</p>
        <p style={commonStyles.clickable} onClick={() => { this.props.gotoPaperKeyPage() }}>Use a paper key</p>
        <p style={commonStyles.clickable} onClick={() => { this.props.gotoUserPassPage() }}>Use my keybase passphrase</p>
      </div>
    )
  }
}

RegisterRender.propTypes = {
  gotoExistingDevicePage: React.PropTypes.func.isRequired,
  gotoPaperKeyPage: React.PropTypes.func.isRequired,
  gotoUserPassPage: React.PropTypes.func.isRequired
}
