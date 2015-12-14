/* @flow */

import React, {Component} from '../base-react'
import {FlatButton} from 'material-ui'

import {ipcRenderer} from 'electron'

import {remote} from 'electron'

import commonStyles, {colors} from '../styles/common'

export default class Render extends Component {
  props: {
    debug?: boolean
  };

  render (): ReactElement {
    return (
      <div>
        <Header/>
        <OpeningMessage/>
        <FolderList/>
        <Footer debug={this.props.debug || false}/>
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
    return (
      <div>
        <div> Success! Some cool message goes here on two lines. </div>
        <div>
          <FlatButton style={commonStyles.primaryButton} label='getStarted'/>
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
  props: {
    debug: boolean
  };

  render () {
    const showMain = () => ipcRenderer.send('showMain')
    const showHelp = () => ipcRenderer.send('showHelp')
    const quit = () => remote.app.emit('destroy')
    return (
      <div>
        <div> Footer lives here </div>
        {this.props.debug && <FlatButton style={commonStyles.primaryButton} label='main' onClick={showMain} />}
        <FlatButton style={commonStyles.primaryButton} label='help' onClick={showHelp} />
        <FlatButton style={commonStyles.primaryButton} label='quit' onClick={quit} />
      </div>
    )
  }
}
