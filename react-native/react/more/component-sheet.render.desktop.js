import React, {Component} from '../base-react'
import {FlatButton} from 'material-ui'
import {connect} from '../base-redux'
import commonStyles from '../styles/common'
import {Header} from '../common-adapters'
import Tracker from '../tracker'
import Menubar from '../menubar'
import Container from './dev-container'
import Update from '../update/index.js'

import {devEditAction} from '../reducers/devEdit'

// Tracker constants
import {normal, warning, error, checking, revoked} from '../constants/tracker'
import {metaUpgraded, metaNew, metaUnreachable, metaPending, metaDeleted, metaNone} from '../constants/tracker'

import * as TrackerConstants from '../constants/tracker'

export default class Render extends Component {
  render () {
    return (
      <div style={{...commonStyles.flexBoxColumn, flex: 1, overflowY: 'auto'}}>
        <Container title='Updater'>
          <Update
            isCritical
            windowTitle='Title'
            oldVersion='1.2.3'
            newVersion='3.2.1'
            description={`# This is a list
  - one
  - two
  - three`}
            alwaysUpdate={false}
            setAlwaysUpdate={() => {}}
            snoozeTime='24 hours'
            updateCommand='ls -laR > /dev/null'
            canUpdate
            onUpdate={() => {}}
            onSnooze={() => {}}
          />
        </Container>
        <Container title='Tracker'>
          <ConnectedTrackerDev/>
        </Container>
        <Container title='Menubar'>
          <Menubar/>
        </Container>
        <Container title='Header No Close'>
          <Header icon title='Title'/>
        </Container>
        <Container title='Header' style={{backgroundColor: 'red'}}>
          <Header icon title='Title' onClose={() => {}}/>
        </Container>
      </div>
  )
  }
}

class TrackerDev extends Component {
  constructor (props) {
    super(props)
    this.state = {}
  }

  usernamePicker () {
    const usernames = Object.keys(this.props.trackers).map(u => <FlatButton key={u} label={u} onClick={() => this.setState({username: u})}/>)
    return (
      <div>
        Pick your username: {usernames}
      </div>
    )
  }

  updateProofKey (username, key, values) {
    const tracker = this.props.trackers[username]

    const updateProofKey = (index, value) => {
      this.props.dispatch(devEditAction(['tracker', 'trackers', username, 'proofs', index, key], value))
      this.props.dispatch({type: TrackerConstants.updateProofState, payload: {username}})
    }

    const valueButtons = index => values.map(v => <FlatButton label={v} onClick={() => updateProofKey(index, v)}/>)
    return (
      <div>
        {tracker.proofs.map((p, i) => <div> {key} for {`${p.name}@${p.type}`}: {valueButtons(i)} </div>)}
      </div>
    )
  }

  updateOverallProof (username, key, values) {
    const tracker = this.props.trackers[username]
    const updateProofKey = (index, value) => this.props.dispatch(devEditAction(['tracker', 'trackers', username, 'proofs', index, key], value))

    const valueButtons = index => values.map(v => <FlatButton label={v} onClick={() => updateProofKey(index, v)}/>)
    return (
      <div>
        {tracker.proofs.map((p, i) => <div> {key} for {p.name}: {valueButtons(i)} </div>)}
      </div>
    )
  }

  render () {
    if (this.state.username) {
      return (
        <div>
          {this.usernamePicker(this.state.username)}
          {this.updateProofKey(this.state.username, 'state', [normal, warning, error, checking, revoked])}
          {this.updateProofKey(this.state.username, 'meta', [metaUpgraded, metaNew, metaUnreachable, metaPending, metaDeleted, metaNone])}
          <Tracker username={this.state.username}/>
        </div>
      )
    } else {
      return this.usernamePicker()
    }
  }
}

const ConnectedTrackerDev = connect(state => state.tracker, dispatch => ({dispatch}))(TrackerDev)
