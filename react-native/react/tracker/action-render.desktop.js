'use strict'
/* @flow */

import React from '../base-react'
import { Checkbox, FloatingActionButton, FlatButton } from 'material-ui'
import BaseComponent from '../base-component'

export default class ActionRender extends BaseComponent {
  render () {
    return (
      <div style={{display: 'flex', flex: 1, justifyContent: 'space-between', padding: 10, backgroundColor: '#E0E0E0'}}>
        <div style={{display: 'flex', flexDirection: 'column'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'flex-start'}}>
            <div style={{minWidth: 200} /* the checkbox does width 100% which is super annoying, fix this when styling */}>
              <Checkbox
                style={{marginRight: -15}}
                value='follow'
                label={'Follow ' + this.props.username}
                checked={this.props.shouldFollow}
                onCheck={() => {
                  this.props.followChecked(!this.props.shouldFollow)
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
  username: React.PropTypes.string.isRequired,
  shouldFollow: React.PropTypes.bool.isRequired,
  onClose: React.PropTypes.func.isRequired,
  onFollowHelp: React.PropTypes.func.isRequired,
  followChecked: React.PropTypes.func.isRequired
}
