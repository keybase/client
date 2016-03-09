import React, {Component} from 'react'
import {globalStyles} from '../styles/style-guide'
import {Checkbox} from '../common-adapters'
import Menubar from '../menubar'

export default class Render extends Component {
  constructor (props) {
    super(props)
    this.state = {
      normalChecked: true,
      normalUnchecked: false,
      disabledChecked: true,
      disabledUnchecked: false
    }
  }

  render () {
    return (
      <div style={{...globalStyles.flexBoxRow, alignItems: 'flex-start', overflowY: 'auto', flexWrap: 'wrap'}}>
        <div style={styles.container}>
          <Checkbox
            label='Normal - checked'
            onCheck={checked => this.setState({normalChecked: checked})}
            checked={this.state.normalChecked} />
          <Checkbox
            label='Normal - unchecked'
            onCheck={checked => this.setState({normalUnchecked: checked})}
            checked={this.state.normalUnchecked} />
          <Checkbox
            label='Disabled - checked'
            onCheck={checked => this.setState({disabledChecked: checked})}
            disabled
            checked={this.state.disabledChecked} />
          <Checkbox
            label='Disabled - unchecked'
            disabled
            onCheck={checked => this.setState({disabledUnchecked: checked})}
            checked={this.state.disabledUnchecked} />
        </div>
        <div style={{...styles.container, ...styles.containerPopup, width: 320}}>
          <Menubar/>
        </div>
      </div>
    )
  }
}

const styles = {
  container: {
    marginTop: 20,
    marginLeft: 20,
    marginBottom: 10
  },
  containerPopup: {
    boxShadow: '0px 0px 10px 0px rgba(0,0,0,0.4)'
  }
}
