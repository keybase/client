import React, {Component} from 'react'
import {globalStyles} from '../styles/style-guide'
import UpdateConfirm from '../update/confirm.js'
import Update from '../update/index.js'

export default class ComponentsUpdate extends Component {
  render () {
    return (
      <div style={{...globalStyles.flexBoxRow, alignItems: 'flex-start', overflowY: 'auto', flexWrap: 'wrap'}}>
        <div style={{...styles.container, ...styles.containerPopup, width: 480, height: 440}}>
          <UpdateConfirm
            windowTitle='Update: Version 3.2.1'
            oldVersion='1.2.3'
            newVersion='3.2.1'
            description={`# What's new?\n\nThis is a list:\n\n- one\n- two\n- three\n\nTumblr kinfolk fashion axe ramps ennui\nHella forage put a bird on it knausgaard fingerstache etsy blog gentrify mumblecore.\nSustainable put a bird on it shabby chic shoreditch\nChurch-key artisan pug fixie marfa man braid try-hard disrupt squid.`}
            alwaysUpdate={false}
            setAlwaysUpdate={() => {}}
            snoozeTime='24 hours'
            canUpdate={false}
            updateCommand='ls -laR > /dev/null'
            onUpdate={() => { console.log('Update') }}
            onSnooze={() => { console.log('Snooze') }}
          />
        </div>
        <div style={{...styles.container, ...styles.containerPopup, width: 480, height: 440}}>
          <UpdateConfirm
            windowTitle='Update: Version 3.2.1'
            oldVersion='1.2.3'
            newVersion='3.2.1'
            alwaysUpdate={false}
            setAlwaysUpdate={() => {}}
            snoozeTime='24 hours'
            canUpdate
            onUpdate={() => { console.log('Update') }}
            onSnooze={() => { console.log('Snooze') }}
          />
        </div>
        <div style={{...styles.container, ...styles.containerPopup, width: 500, height: 345}}>
          <Update
            type='paused'
            options={{
              onForce: () => {},
              onKillProcesses: () => {},
              onCancel: () => {},
            }}
            />
        </div>
      </div>
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Components (Update)'},
    }
  }
}

const styles = {
  container: {
    marginTop: 20,
    marginLeft: 10,
    marginBottom: 10,
  },
  containerPopup: {
    boxShadow: '0px 0px 10px 0px rgba(0,0,0,0.4)',
  },
}
