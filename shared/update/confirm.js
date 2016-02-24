/* @flow */
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {Snackbar} from 'material-ui'
import {Header, Text, Button, Checkbox} from '../common-adapters'
import {clipboard} from 'electron'
import marked from 'marked'
import {autoResize} from '../../desktop/renderer/remote-component-helper'
import {globalStyles, globalColors} from '../styles/style-guide'

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
      snackbarOpen: false
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
    const realCSS = `
      .clipboard { color: ${globalColors.grey3}; }
      .clipboard:hover { color: white; }
    `

    const whatsNew = this.props.description ? marked(this.props.description, {sanitize: true}) : 'Bug fixes'

    return (
      <div style={styles.container}>
        <style>{realCSS}</style>
        <Header
          icon
          title={this.props.isCritical ? 'Critical Update' : this.props.windowTitle}
          onClose={() => this.props.onSnooze()}
        />
        <div style={styles.headerContainer}>
          <Text type='Header' reversed>Version {this.props.newVersion}</Text>
          <Text type='Body' reversed style={{marginTop: 20}}>Fellow Keybaser!</Text>
          <Text type='Body' reversed>{`The version you are currently running (${this.props.oldVersion}) is outdated. We highly recommend that you upgrade now.`}</Text>
        </div>
        <div style={styles.body}>
          <Text type='Body'>What's new?</Text>
          <div style={styles.descriptionBlock} dangerouslySetInnerHTML={{__html: whatsNew}} />
        </div>
        {this.props.updateCommand &&
          <Text style={styles.updateCommandHeader} type='Body'>Terminal command:</Text>}
        {this.props.updateCommand &&
          <div style={styles.command}>
            <Text type='Body' reversed style={{flex: 1}}>&gt; {this.props.updateCommand}</Text>
            <div className='clipboard' title='Copy to clipboard' style={styles.clipboard} onClick={() => this.onCopy()}>
              <i className='fa fa-clipboard'></i>
            </div>
          </div>}
        <div style={styles.actions}>
          <Button type='Secondary' label={`Ignore for ${this.props.snoozeTime}`} onClick={() => this.props.onSnooze()} />
          {this.props.canUpdate &&
            <Button type='Primary' label='Update' onClick={() => this.props.onUpdate()} />}
          {!this.props.canUpdate &&
            <Button type='Primary' label='Done, close!' onClick={() => this.props.onSnooze()} />}
        </div>
        {this.props.canUpdate &&
          <div style={{...styles.actions, justifyContent: 'flex-end'}}>
            <Checkbox
              checked={this.props.alwaysUpdate}
              label='Update automatically'
              onCheck={checked => this.props.setAlwaysUpdate(checked)}/>
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
    ...globalStyles.flexBoxColumn
  },
  headerContainer: {
    ...globalStyles.flexBoxColumn,
    color: globalColors.white,
    padding: 20,
    backgroundColor: globalColors.blue
  },
  actionsContainer: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'flex-end'
  },
  why: {
    margin: 0
  },
  critical: {
    margin: 0,
    fontSize: 12
  },
  body: {
    padding: 20
  },
  descriptionBlock: {
    ...globalStyles.fontCourier,
    ...globalStyles.rounded,
    backgroundColor: globalColors.grey5,
    border: `solid ${globalColors.grey3} 1px`,
    marginTop: 20,
    maxHeight: 205,
    overflowY: 'auto',
    padding: 20
  },
  actions: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'flex-end',
    padding: 20,
    paddingTop: 0
  },
  updateCommandHeader: {
    margin: 20
  },
  command: {
    ...globalStyles.flexBoxRow,
    color: globalColors.white,
    backgroundColor: globalColors.grey1,
    paddingLeft: 30,
    marginBottom: 20,
    alignItems: 'center'
  },
  clipboard: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'center',
    alignItems: 'center',
    width: 110,
    height: 90,
    borderLeft: `solid ${globalColors.grey2} 1px`
  }
}

export default connect(
  state => state.updateConfirm,
    undefined,
    (stateProps, dispatchProps, ownProps) => {
      return {
        ...stateProps,
        ...dispatchProps,
        ...ownProps
      }
    }
)(UpdateConfirm)
