import React, {Component} from 'react'
import {globalStyles} from '../styles/style-guide'
import {Checkbox} from '../common-adapters'
import Menubar from '../menubar'
import UpdateConfirm from '../update/confirm.js'
import Update from '../update/index.js'

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
      <div style={{...globalStyles.flexBoxRow, alignItems: 'flex-start', overflowY: 'auto'}}>
        <div style={styles.container}>
          <Checkbox
            dz2
            label='Normal - checked'
            onCheck={checked => this.setState({normalChecked: checked})}
            checked={this.state.normalChecked} />
          <Checkbox
            dz2
            label='Normal - unchecked'
            onCheck={checked => this.setState({normalUnchecked: checked})}
            checked={this.state.normalUnchecked} />
          <Checkbox
            dz2
            label='Disabled - checked'
            onCheck={checked => this.setState({disabledChecked: checked})}
            disabled
            checked={this.state.disabledChecked} />
          <Checkbox
            dz2
            label='Disabled - unchecked'
            disabled
            onCheck={checked => this.setState({disabledUnchecked: checked})}
            checked={this.state.disabledUnchecked} />
        </div>
        <div style={{...styles.container, ...styles.containerPopup, width: 320}}>
          <Menubar/>
        </div>
        <div style={{...styles.container, ...styles.containerPopup, width: 480}}>
          <UpdateConfirm
            windowTitle='Title'
            isCritical
            oldVersion='1.2.3'
            newVersion='3.2.1'
            description={`# This is a list\n- one\n- two\n- three`}
            alwaysUpdate={false}
            setAlwaysUpdate={() => {}}
            snoozeTime='24 hours'
            updateCommand='ls -laR > /dev/null'
            canUpdate
            onUpdate={() => { console.log('Update') }}
            onSnooze={() => { console.log('Snooze') }}
          />
        </div>
        <div style={{...styles.container, ...styles.containerPopup, width: 500}}>
          <Update
            type='paused'
            options={{
              onForce: () => {},
              onKillProcesses: () => {},
              onCancel: () => {}
            }}
            />
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
