/* @flow */
import React, {Component} from '../base-react'
import {Snackbar, Checkbox, FlatButton} from 'material-ui'
import commonStyles, {colors} from '../styles/common'
import Header from '../common-adapters/header'
import {clipboard} from 'electron'
import resolveAssets from '../../../desktop/resolve-assets'
import marked from 'marked'
import type {RenderProps} from './index.render'

export default class UpdateRender extends Component {
  props: RenderProps;

  constructor (props: RenderProps) {
    super(props)

    this.state = {
    }
  }

  onCopy () {
    clipboard.writeText(this.props.updateCommand)
    this.refs.clipboardSnackbar.show()
  }

  render (): ReactElement {
    const realCSS = `
      .clipboard { color: #A29E9E; }
      .clipboard:hover { color: white; }
    `
    return (
      <div style={styles.container}>
        <style>{realCSS}</style>
        <Header
          style={styles.header}
          icon={`file://${resolveAssets('../react-native/react/images/service/keybase.png')}`}
          title={this.props.windowTitle}
          onClose={() => this.props.onSnooze()}
        />
        <div style={styles.headerContainer}>
          <h1 style={{...commonStyles.h1, marginBottom: 0}}>Update to version {this.props.newVersion}</h1>
          {this.props.isCritical && <p style={styles.critical}>Critical Update</p>}
          <p style={{...styles.why, marginTop: 30}}>Fellow Keybaser!</p>
          <p style={{...styles.why, marginBottom: 30}}>{`The version you are currently running (${this.props.oldVersion}) is oudated. We highly recommend that you upgrade now.`}</p>
        </div>
        <div style={styles.body}>
          <p style={styles.descriptionHeader}>What's new?</p>
          <div style={styles.descriptionBlock} dangerouslySetInnerHTML={{__html: marked(this.props.description, {sanitize: true})}} />
          {this.props.updateCommand && <p style={styles.descriptionHeader}>Linux command:</p> }
        </div>
        {this.props.updateCommand &&
        <div style={styles.command}>
          <p style={{...styles.descriptionHeader, flex: 1}}>&gt; {this.props.updateCommand}</p>
          <div className='clipboard' title='Copy to clipboard' style={styles.clipboard} onClick={() => this.onCopy()}>
            <i className='fa fa-clipboard'></i>
          </div>
        </div>
        }
        <div style={styles.actions}>
          <FlatButton style={{...commonStyles.secondaryButton, width: 'initial'}} label={`Ignore for ${this.props.snoozeTime}`} onClick={() => this.props.onSnooze()} />
          {this.props.canUpdate && <FlatButton style={{...commonStyles.primaryButton, flex: 1, width: 'initial'}} label='Update' onClick={() => this.props.onUpdate()} />}
          {!this.props.canUpdate && <FlatButton style={{...commonStyles.primaryButton, flex: 1, width: 'initial'}} label='Done, close!' onClick={() => this.props.onSnooze()} />}
        </div>
        {this.props.canUpdate &&
        <div style={{...styles.actions, justifyContent: 'flex-end'}}>
          <Checkbox
            value={this.props.alwaysUpdate}
            labelStyle={styles.checkLabel}
            label='Update automatically'
            defaultChecked={this.props.alwaysUpdate}
            style={styles.checkbox}
            onCheck={(_, checked) => this.props.setAlwaysUpdate(checked)}/>
        </div>
        }
        <Snackbar
          ref='clipboardSnackbar'
          message='Copied to clipboard!'
          autoHideDuration='1000'
        />
        </div>
    )
  }
}

UpdateRender.propTypes = {
  isCritical: React.PropTypes.bool.isRequired,
  windowTitle: React.PropTypes.string.isRequired,
  oldVersion: React.PropTypes.string.isRequired,
  newVersion: React.PropTypes.string.isRequired,
  description: React.PropTypes.string.isRequired,
  alwaysUpdate: React.PropTypes.bool.isRequired,
  setAlwaysUpdate: React.PropTypes.func.isRequired,
  snoozeTime: React.PropTypes.string.isRequired,
  updateCommand: React.PropTypes.string.isRequired,
  canUpdate: React.PropTypes.bool.isRequired,
  onUpdate: React.PropTypes.func.isRequired,
  onSnooze: React.PropTypes.func.isRequired
}

const styles = {
  container: {
    ...commonStyles.flexBoxColumn
  },
  headerContainer: {
    ...commonStyles.flexBoxColumn,
    color: colors.white,
    paddingLeft: 32,
    paddingRight: 32,
    backgroundColor: colors.backgroundBlue
  },
  actionsContainer: {
    ...commonStyles.flexBoxRow,
    justifyContent: 'flex-end'
  },
  why: {
    margin: 0
  },
  critical: {
    margin: 0,
    fontSize: 12
  },
  header: {
    height: 34
  },
  body: {
    paddingLeft: 30,
    paddingRight: 30,
    paddingTop: 32,
    paddingBottom: 0
  },
  descriptionHeader: {
  },
  descriptionBlock: {
    backgroundColor: colors.codeBackground,
    maxHeight: 205,
    overflowY: 'auto',
    padding: 20
  },
  actions: {
    ...commonStyles.flexBoxRow,
    paddingLeft: 30,
    paddingRight: 30,
    paddingTop: 10,
    marginBottom: 10
  },
  checkbox: {
    width: 'initial'
  },
  checkLabel: {
    ...commonStyles.noWrapCheckboxLabel,
    fontSize: 13
  },
  command: {
    ...commonStyles.flexBoxRow,
    color: colors.white,
    backgroundColor: colors.darkGreyBackground,
    paddingLeft: 30,
    alignItems: 'center'
  },
  clipboard: {
    ...commonStyles.flexBoxRow,
    justifyContent: 'center',
    alignItems: 'center',
    width: 110,
    height: 90,
    borderLeft: 'solid #525252 1px'
  }
}
