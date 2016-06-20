/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {Snackbar} from 'material-ui'
import {Header, Text, Button, Checkbox, Icon, Terminal} from '../common-adapters'
import {clipboard} from 'electron'
import marked from 'marked'
import {globalStyles, globalColors} from '../styles/style-guide'
import {autoResize} from '../../desktop/renderer/remote-component-helper'

type RenderProps = {
  isCritical: bool,
  windowTitle: string,
  oldVersion: string,
  newVersion: string,
  description: string,
  alwaysUpdate: bool,
  setAlwaysUpdate: (alwaysUpdate: bool) => void,
  snoozeTime: string,
  updateCommand: ?string,
  canUpdate: bool,
  onUpdate: () => void,
  onSnooze: () => void
}

class UpdateConfirm extends Component {
  props: RenderProps;
  state: {
    snackbarOpen: boolean
  };

  constructor (props: RenderProps) {
    super(props)

    this.state = {
      snackbarOpen: false,
    }
  }

  onCopy () {
    clipboard.writeText(this.props.updateCommand)
    this.setState({snackbarOpen: true})
  }

  componentDidMount () {
    autoResize()
  }

  render () {
    const descriptionHTML = this.props.description ? marked(this.props.description, {sanitize: true}) : 'What\'s new?<br/>Bug fixes'

    return (
      <div style={styles.container}>
        <Header
          type='Strong'
          title={this.props.windowTitle}
          onClose={() => this.props.onSnooze()}
        />
        <div style={{...styles.headerContainer}}>
          <div style={{...globalStyles.flexBoxCenter, paddingBottom: 15}}>
            <Icon type='keybase-update' />
          </div>
          {!this.props.updateCommand &&
            <Text type='BodySemibold' style={{paddingLeft: 30, paddingRight: 30, textAlign: 'center'}}>
              {`The version you are currently running (${this.props.oldVersion}) is outdated.`}
            </Text>}
          {this.props.updateCommand &&
            <div style={{flex: 1, ...globalStyles.flexBoxColumn}}>
              <Text type='BodySemibold' style={{paddingLeft: 30, paddingRight: 30, textAlign: 'center'}}>
                {`The version you are currently running (${this.props.oldVersion}) is outdated. Run this command to update:`}
              </Text>
              <Terminal style={{marginTop: 15}}>
                <Text type='Terminal' style={{paddingLeft: 20, paddingRight: 20, paddingTop: 5, paddingBottom: 5}}>
                  {this.props.updateCommand}
                </Text>
              </Terminal>
            </div>}
        </div>

        <div style={{...styles.body}}>
          <div style={styles.descriptionBlock} dangerouslySetInnerHTML={{__html: descriptionHTML}} />
        </div>

        <div style={{...styles.actionsContainer}}>
          <Button type='Secondary' label={`Ignore for ${this.props.snoozeTime}`} onClick={() => this.props.onSnooze()} />
          {this.props.canUpdate &&
            <Button type='Primary' label='Update' onClick={() => this.props.onUpdate()} />}
          {!this.props.canUpdate &&
            this.props.updateCommand &&
            <Button type='Primary' label='I ran the above command' onClick={() => this.props.onSnooze()} />}
        </div>
        {this.props.canUpdate &&
          <div style={{...styles.actionsContainer, paddingTop: 9, paddingRight: 10}}>
            <Checkbox
              checked={this.props.alwaysUpdate}
              label='Update automatically'
              onCheck={checked => this.props.setAlwaysUpdate(checked)} />
          </div>}
        <Snackbar
          message='Copied to clipboard!'
          autoHideDuration={1000}
          onRequestClose={() => this.setState({snackbarOpen: false})}
          open={this.state.snackbarOpen}
        />
      </div>
    )
  }
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    marginBottom: 30,
  },
  headerContainer: {
    ...globalStyles.flexBoxColumn,
    paddingTop: 35,
    paddingBottom: 15,
  },
  actionsContainer: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'flex-end',
    marginRight: 20,
  },
  body: {
    paddingLeft: 30,
    paddingRight: 30,
    paddingBottom: 15,
  },
  descriptionBlock: {
    ...globalStyles.fontTerminal,
    lineHeight: '21px',
    fontSize: 14,
    color: globalColors.black_75,
    backgroundColor: globalColors.lightGrey,
    border: `solid ${globalColors.black_10} 1px`,
    minHeight: 130,
    maxHeight: 130,
    overflowY: 'auto',
    padding: 15,
  },
}

export default connect(
  state => state.updateConfirm
)(UpdateConfirm)
