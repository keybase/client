/* @flow */
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {Header, Text} from '../common-adapters/index.desktop'
import {Button} from '../common-adapters'
import {globalStyles} from '../styles/style-guide'

type RenderProps = {
  onForce: () => void,
  onKillProcesses: () => void,
  onCancel: () => void
}

class UpdatePaused extends Component {
  props: RenderProps;

  render () {
    return (
      <div style={styles.container}>
        <Header title='Update Paused' icon onClose={() => this.props.onCancel()} />
        <div style={styles.info}>
          <Text type='Header' style={styles.infoHeader}>You have files, folders or a terminal open in Keybase.</Text>
          <Text type='Body' style={styles.infoBody}>
            You can force the update. That would be like yanking a USB drive and plugging it right back in.
            It'll instantly give you the latest version of Keybase, but you'll need to reopen any files you're working with.
            If you're working in the terminal, you'll need to cd out of /keybase and back in.
          </Text>
        </div>
        <div style={styles.actions}>
          <Button type='Secondary' label='Force' onClick={() => this.props.onForce()} />
          <Button type='Primary' label='Try Later' onClick={() => this.props.onCancel()} />
        </div>
      </div>
    )
  }
  // <Button label='Quit Processes' onClick={() => this.props.onKillProcesses()} />
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn
  },
  info: {
    marginLeft: 30,
    marginRight: 30
  },
  infoHeader: {
    marginTop: 30
  },
  infoBody: {
    marginTop: 15
  },
  actions: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'flex-end',
    marginTop: 20,
    marginRight: 30,
    marginBottom: 30
  }
}

export default connect(
  state => state.updatePaused,
    undefined,
    (stateProps, dispatchProps, ownProps) => {
      return {
        ...stateProps,
        ...dispatchProps,
        ...ownProps
      }
    }
)(UpdatePaused)
