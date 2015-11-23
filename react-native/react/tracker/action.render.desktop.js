'use strict'
/* @flow */

// $FlowIssue base-react
import React, {Component} from '../base-react'
import {Checkbox, FloatingActionButton, FlatButton} from 'material-ui'

import commonStyles from '../styles/common'

import {normal, pending} from '../constants/tracker'

import type {SimpleProofState} from '../constants/tracker'

export type ActionProps = {
  state: SimpleProofState,
  username: ?string,
  shouldFollow: ?boolean,
  renderChangedTitle: string,
  onClose: () => void,
  onRefollow: () => void,
  onUnfollow: () => void,
  onFollowHelp: () => void,
  onFollowChecked: () => void
}

export default class ActionRender extends Component {
  props: ActionProps;

  render (): ReactElement {
    const {username, state} = this.props

    if (state === pending || !username) {
      return this.renderPending()
    } else if (this.props.state === normal) {
      return this.renderNormal(username)
    } else {
      return this.renderChanged(username)
    }
  }

  renderPending (): ReactElement {
    return (
      <div><p> Loading... </p></div>
    )
  }

  renderChanged (username: string): ReactElement {
    //const title = this.props.state === warning ? `(warning) ${username} added some verifications`
    //  : `(error) Some of ${username}'s verifications are compromised or have changed.`
    const title = this.props.renderChangedTitle
    return (
      <div style={{display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', padding: 10, backgroundColor: '#E0E0E0'}}>
        <p>{title}</p>
        <div style={{alignSelf: 'stretch', display: 'flex', flex: 1, justifyContent: 'space-between', padding: 10, backgroundColor: '#E0E0E0'}}>
          <FlatButton style={{alignSelf: 'center'}} label={'Unfollow ' + username} primary onTouchTap={() => this.props.onUnfollow()} />
          <FlatButton style={{alignSelf: 'center'}} label='Refollow' primary onTouchTap={() => this.props.onRefollow()} />
        </div>
      </div>
    )
  }

  renderNormal (username: string): ReactElement {
    return (
      <div style={styles.container}>
        <div style={{display: 'flex', flexDirection: 'column'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'flex-start'}}>
            <div style={{minWidth: 200} /* the checkbox does width 100% which is super annoying, fix this when styling */}>
              <Checkbox
                style={{marginRight: -15}}
                value='follow'
                label={'Follow ' + username}
                checked={this.props.shouldFollow}
                onCheck={() => {
                  this.props.onFollowChecked(!this.props.shouldFollow)
                }}
                />
              </div>
            <FloatingActionButton mini style={{fontSize: 25}} onTouchTap={() => this.props.onFollowHelp() }>?</FloatingActionButton>
          </div>
          {!this.props.shouldFollow && <p>You'll see this card every time you access the folder</p>}
        </div>
        <FlatButton style={{alignSelf: 'center'}} label='Close' primary onTouchTap={() => this.props.onClose()} />
      </div>
    )
  }
}

ActionRender.propTypes = {
  state: React.PropTypes.any.isRequired,
  username: React.PropTypes.string,
  shouldFollow: React.PropTypes.bool.isRequired,
  onClose: React.PropTypes.func.isRequired,
  onRefollow: React.PropTypes.func.isRequired,
  onUnfollow: React.PropTypes.func.isRequired,
  onFollowHelp: React.PropTypes.func.isRequired,
  onFollowChecked: React.PropTypes.func.isRequired
}

const styles = {
  container: {
    ...commonStyles.flexBoxRow,
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#E0E0E0'
  }
}
