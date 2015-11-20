import React, {Component} from '../../../base-react'
import commonStyles from '../../../styles/common'

export default class ExistingDeviceRender extends Component {
  render () {
    return (
      <div style={{display: 'flex', flex: 1, flexDirection: 'column', marginTop: 200, padding: 20, alignItems: 'stretch'}}>
        <h1>What type of device would you like to connect this device with?</h1>
        <div style={{display: 'flex', flex: 1, flexDirection: 'row', marginTop: 40, justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: 40, paddingRight: 40}}>
          <div style={{...commonStyles.clickable, ...{display: 'flex', flexDirection: 'column', alignItems: 'center'}}} onClick={() => this.props.onSubmitComputer()}>
            <p>[Desktop icon]</p>
            <p>Desktop Device &gt;</p>
          </div>
          <div style={{...commonStyles.clickable, ...{display: 'flex', flexDirection: 'column', alignItems: 'center'}}} onClick={() => this.props.onSubmitPhone()}>
            <p>[Mobile icon]</p>
            <p>Mobile Device &gt;</p>
          </div>
        </div>
      </div>
    )
  }
}

ExistingDeviceRender.propTypes = {
  onSubmitComputer: React.PropTypes.func.isRequired,
  onSubmitPhone: React.PropTypes.func.isRequired
}
