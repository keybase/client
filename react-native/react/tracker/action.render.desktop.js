/* @flow */

import React, {Component} from '../base-react'
import {FlatButton} from 'material-ui'

import commonStyles from '../styles/common'
import type {Styled} from '../styles/common'

import {normal, checking, warning} from '../constants/tracker'

import type {ActionProps} from './action.render.types'

export default class ActionRender extends Component {
  props: ActionProps & Styled;

  render (): ReactElement {
    const {username, state} = this.props

    if (state === checking || !username) {
      return this.renderPending()
    } else if (this.props.state === normal) {
      return this.renderNormal(username)
    } else if (this.props.currentlyFollowing) {
      return this.renderChanged()
    } else {
      return this.renderWarningNotFollowed()
    }
  }

  renderPending (): ReactElement {
    return (
      <div><p> Loading... </p></div>
    )
  }

  renderWarningNotFollowed (): ReactElement {
    const title = this.props.failedProofsNotFollowingText

    return (
      <div style={{...styles.normalContainer, ...this.props.style}}>
        <i style={this.props.state === warning ? styles.flagWarning : styles.flagError} className='fa fa-flag'></i>
        <div style={styles.textContainer}>
          <span style={styles.changedMessage}>{title}</span>
        </div>
        <div style={styles.checkContainer} onClick={() => this.props.onFollowChecked(!this.props.shouldFollow)}>
          <i style={styles.check} className={`fa ${this.props.shouldFollow ? 'fa-check-square-o' : 'fa-square-o'}`}></i>
          <span style={styles.track}>Track</span>
          <i style={styles.eye} className='fa fa-eye'></i>
        </div>
        <FlatButton style={commonStyles.primaryButton} label='Close' primary onClick={() => this.props.onClose()} />
      </div>
    )
  }

  renderChanged (): ReactElement {
    const title = this.props.renderChangedTitle

    return (
      <div style={{...styles.normalContainer, ...this.props.style}}>
        <i style={this.props.state === warning ? styles.flagWarning : styles.flagError} className='fa fa-flag'></i>
        <div style={styles.textContainer}>
          <span style={styles.changedMessage}>{title}</span>
        </div>
        <FlatButton style={commonStyles.secondaryButton} label='Untrack' onClick={() => this.props.onUnfollow()} />
        <FlatButton style={commonStyles.primaryButton} label='Retrack' primary onClick={() => this.props.onRefollow()} />
      </div>
    )
  }

  renderNormal (username: string): ReactElement {
    return (
      <div style={{...styles.normalContainer, ...this.props.style}}>
        <div style={{...styles.textContainer, ...(this.props.shouldFollow ? {display: 'none'} : {})}}>
          <span style={styles.youShouldFollow}>You'll see this card every time you access the folder.</span>
        </div>
        <div style={styles.checkContainer} onClick={() => this.props.onFollowChecked(!this.props.shouldFollow)}>
          <i style={styles.check} className={`fa ${this.props.shouldFollow ? 'fa-check-square-o' : 'fa-square-o'}`}></i>
          <span style={styles.track}>Track</span>
          <i style={styles.eye} className='fa fa-eye'></i>
        </div>
        <FlatButton style={commonStyles.primaryButton} label='Close' primary onClick={() => this.props.onClose()} />
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
  onFollowChecked: React.PropTypes.func.isRequired,
  renderChangedTitle: React.PropTypes.string.isRequired,
  failedProofsNotFollowingText: React.PropTypes.string.isRequired,
  style: React.PropTypes.object.isRequired
}

const styles = {
  normalContainer: {
    ...commonStyles.flexBoxRow,
    ...commonStyles.noSelect,
    alignItems: 'center',
    backgroundColor: 'white',
    justifyContent: 'flex-end',
    paddingLeft: 15,
    paddingRight: 15
  },
  textContainer: {
    ...commonStyles.flexBoxRow,
    justifyContent: 'center',
    marginRight: 15,
    flex: 1,
    fontSize: 13,
    lineHeight: '17px'
  },
  youShouldFollow: {
    color: '#858596',
    maxWidth: 182,
    textAlign: 'center'
  },
  changedMessage: {
    ...commonStyles.fontBold,
    color: '#4444',
    textAlign: 'center'
  },
  checkContainer: {
    ...commonStyles.clickable
  },
  check: {
    marginRight: 3,
    width: 17
  },
  track: {
    color: '#444444',
    fontSize: 15,
    marginRight: 3
  },
  eye: {
    color: '#444444',
    marginRight: 17,
    width: 14
  },
  flagWarning: {
    color: '#f5a623',
    width: 20
  },
  flagError: {
    color: '#d0021b',
    width: 20
  }
}
