/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {Header, Text, Icon} from '../common-adapters'
import {Button} from '../common-adapters'
import {globalStyles} from '../styles/style-guide'
import {autoResize} from '../../desktop/renderer/remote-component-helper'

type RenderProps = {
  onForce: () => void,
  onKillProcesses: () => void,
  onCancel: () => void
}

class UpdatePaused extends Component {
  props: RenderProps;

  componentDidMount () {
    autoResize()
  }

  render () {
    return (
      <div style={styles.container}>
        <Header type='Strong' title='Update Paused' icon onClose={() => this.props.onCancel()} />
        <div style={styles.body}>
          <div style={{...globalStyles.flexBoxCenter, paddingTop: 15, paddingBottom: 15}}>
            <Icon type='keybase-update-pause' />
          </div>
          <div style={{paddingBottom: 15}}>
            <Text type='BodySemibold'>You have files, folders or a terminal open in Keybase.</Text>
          </div>
          <Text type='BodySmall' style={{paddingBottom: 15}}>
            You can force the update. That would be like yanking a USB drive and plugging it right back in.
            It'll instantly give you the latest version of Keybase, but you'll need to reopen any files you're working with.
            If you're working in the terminal, you'll need to&nbsp;
          </Text>
          <Text type='TerminalSmall'>cd</Text>
          <Text type='BodySmall'>&nbsp;out of&nbsp;</Text>
          <Text type='TerminalSmall'>/keybase</Text>
          <Text type='BodySmall'>&nbsp;and back in.</Text>

          <div style={styles.actions}>
            <Button type='Secondary' label='Force update' onClick={() => this.props.onForce()} />
            <Button type='Primary' label='Try again later' onClick={() => this.props.onCancel()} />
          </div>
        </div>
      </div>
    )
  }
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
  },
  body: {
    paddingTop: 15,
    paddingLeft: 30,
    paddingRight: 30,
    paddingBottom: 30,
    textAlign: 'center',
  },
  actions: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'flex-end',
    marginTop: 15,
  },
}

export default connect(
  state => state.updatePaused
)(UpdatePaused)
