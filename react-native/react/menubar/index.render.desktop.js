/* @flow */

import React, {Component} from '../base-react'
import {FlatButton} from 'material-ui'

import {ipcRenderer} from 'electron'

import {remote} from 'electron'

import commonStyles, {colors} from '../styles/common'

export default class Render extends Component {
  render () {
    return (
      <div>
        <Header/>
        <OpeningMessage/>
        <FolderList/>
        <Footer/>
        <div>{Object.keys(this.props)}</div>
      </div>
    )
  }
}

class Header extends Component {
  render () {
    return (
      <div>
        <span>FOLDER</span>
        <span>website</span>
        <span>usage</span>
      </div>
    )
  }
}

class OpeningMessage extends Component {
  render () {
    const showMain = () => ipcRenderer.send('showMain')
    return (
      <div>
        <div> Success! Some cool message goes here on two lines. </div>
        <div>
          <FlatButton style={commonStyles.primaryButton} label='getStarted' onClick={showMain} />
        </div>
      </div>
    )
  }
}

class FolderList extends Component {
  render () {
    return (
      <div> Folders will go here </div>
    )
  }
}

class Footer extends Component {
  render () {
    const showHelp = () => ipcRenderer.send('showHelp')
    const quit = () => remote.app.emit('destroy')
    return (
      <div>
        <div> Footer lives here </div>
        <FlatButton style={commonStyles.primaryButton} label={'help'} onClick={showHelp} />
        <FlatButton style={commonStyles.primaryButton} label={'quit'} onClick={quit} />
      </div>
    )
  }
}
