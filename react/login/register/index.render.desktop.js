import React, {Component} from '../../base-react'
import commonStyles from '../../styles/common'

export default class RegisterRender extends Component {
  render () {
    return (
      <div style={{display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
        <p>Register</p>
        <p style={commonStyles.clickable} onClick={() => { this.props.onGotoExistingDevicePage() }}>Use an existing device</p>
        <p style={commonStyles.clickable} onClick={() => { this.props.onGotoPaperKeyPage() }}>Use a paper key</p>
        <p style={commonStyles.clickable} onClick={() => { this.props.onGotoUserPassPage() }}>Use my keybase passphrase</p>
      </div>
    )
  }
}

RegisterRender.propTypes = {
  onGotoExistingDevicePage: React.PropTypes.func.isRequired,
  onGotoPaperKeyPage: React.PropTypes.func.isRequired,
  onGotoUserPassPage: React.PropTypes.func.isRequired
}
