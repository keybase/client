// @flow

import React, {Component} from 'react'
import {globalStyles} from '../styles/style-guide'
import {Text, Button, Icon} from '../common-adapters'

export type Props = {
  onAccessFolders: () => void,
}

export default class PaperKeyInput extends Component<void, Props, void> {

  render () {
    return (
      <div style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
        <Icon style={foldersUnlockedStyle} type='folders-unlocked-m' />
        <Text style={successStyle} type='Body'>Success</Text>
        <Text style={{textAlign: 'center'}} type='Body'>You have unlocked your folders on this computer.</Text>
        <Button type='Primary' label='Access my folders' style={finishStyle} onClick={this.props.onAccessFolders} />
      </div>
    )
  }
}

const foldersUnlockedStyle = {
  marginTop: 72,
}

const successStyle = {
  marginTop: 28,
  textAlign: 'center',
}

const finishStyle = {
  marginTop: 56,
  marginRight: 30,
  height: 32,
  width: 181,
  alignSelf: 'flex-end',
}
