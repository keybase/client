/* @flow */

import React, {Component} from 'react'
import {FlatButton} from 'material-ui'
import {Button} from '../common-adapters'
import commonStyles from '../styles/common'
import {globalColors} from '../styles/style-guide'
import {normal, checking, warning} from '../constants/tracker'
import flags from '../util/feature-flags'
import {Text} from '../common-adapters'

import type {ActionProps} from './action.render'

export default class ActionRender extends Component {
  props: ActionProps;

  render () {
    if (flags.tracker2) {
      return this.render2()
    }
    return this.renderDefault()
  }

  renderDefault () {
    const {username, state, loggedIn} = this.props
    const styles = styles1

    if (!loggedIn) {
      return this.renderLoggedOut(styles)
    } else if (state === checking || !username) {
      return this.renderPending(styles, username)
    } else if (this.props.state === normal) {
      return this.renderNormal(styles, username)
    } else if (this.props.currentlyFollowing) {
      return this.renderChanged(styles)
    } else {
      return this.renderWarningNotFollowed(styles)
    }
  }

  render2 () {
    const styles = styles2
    return (
      <div style={{...styles.container}}>
        <Button type='Secondary' label='Close' onClick={() => this.props.onClose()} />
      </div>
    )
  }

  renderPending (styles: Object, username: ?string) {
    const text: string = username ? `Verifying ${username}'s identity` : 'Loading tracker information...'
    return (
      <div><Text style={{textAlign: 'center', paddingTop: 8}} type='Body'>{text}</Text></div>
    )
  }

  renderWarningNotFollowed (styles: Object) {
    const title = this.props.failedProofsNotFollowingText

    return (
      <div style={styles.normalContainer}>
        <i style={this.props.state === warning ? styles.flagWarning : styles.flagError} className='fa fa-flag'></i>
        <div style={styles.textContainer}>
          <span style={styles.changedMessage}>{title}</span>
        </div>
        <div style={styles.checkContainer} onClick={() => this.props.onFollowChecked(!this.props.shouldFollow)}>
          <i style={styles.check} className={`fa ${this.props.shouldFollow ? 'fa-check-square-o' : 'fa-square-o'}`}></i>
          <span style={styles.track}>Track</span>
          <i style={styles.eye} className='fa fa-eye'></i>
        </div>
        <FlatButton style={commonStyles.primaryButton} label='Close' primary onClick={() => this.props.onMaybeTrack()} />
      </div>
    )
  }

  renderChanged (styles: Object) {
    const title = this.props.renderChangedTitle

    return (
      <div>
        <i style={this.props.state === warning ? styles.flagWarning : styles.flagError} className='fa fa-flag'></i>
        <div style={styles.textContainer}>
          {title && <span style={styles.changedMessage}>{title}</span>}
        </div>

        <FlatButton style={commonStyles.secondaryButton} label='Untrack' onClick={() => this.props.onUnfollow()} />
        <FlatButton style={commonStyles.primaryButton} label='Retrack' primary onClick={() => this.props.onRefollow()} />
      </div>
    )
  }

  renderNormal (styles: any, username: string) {
    return (
      <div style={styles.normalContainer}>
        <div style={{...styles.textContainer, ...(this.props.shouldFollow ? {display: 'none'} : {})}}>
          <span style={styles.youShouldFollow}>You'll see this card every time you access the folder.</span>
        </div>
        <div style={styles.checkContainer} onClick={() => this.props.onFollowChecked(!this.props.shouldFollow)}>
          <i style={styles.check} className={`fa ${this.props.shouldFollow ? 'fa-check-square-o' : 'fa-square-o'}`}></i>
          <span style={styles.track}>Track</span>
          <i style={styles.eye} className='fa fa-eye'></i>
        </div>
        <FlatButton style={commonStyles.primaryButton} label='Close' primary onClick={() => this.props.onMaybeTrack()} />
      </div>
    )
  }

  renderLoggedOut (styles: Object) {
    return (
      <div>
        <i style={styles.flagWarning} className='fa fa-exclamation-triangle'></i>
        <div style={styles.textContainer}>
          <span style={styles.changedMessage}>You should <span style={styles.command}>keybase login</span> or <span style={styles.command}>keybase signup</span> from the terminal for more options.</span>
        </div>

        <FlatButton style={commonStyles.primaryButton} label='Close' primary onClick={() => this.props.onClose()} />
      </div>
    )
  }
}

ActionRender.propTypes = {
  state: React.PropTypes.any.isRequired,
  loggedIn: React.PropTypes.bool.isRequired,
  username: React.PropTypes.string,
  shouldFollow: React.PropTypes.bool.isRequired,
  onClose: React.PropTypes.func.isRequired,
  onMaybeTrack: React.PropTypes.func.isRequired,
  onRefollow: React.PropTypes.func.isRequired,
  onUnfollow: React.PropTypes.func.isRequired,
  onFollowChecked: React.PropTypes.func.isRequired,
  renderChangedTitle: React.PropTypes.string,
  failedProofsNotFollowingText: React.PropTypes.string.isRequired,
  currentlyFollowing: React.PropTypes.bool.isRequired
}

const styles1 = {
  normalContainer: {
    ...commonStyles.flexBoxRow,
    ...commonStyles.noSelect,
    alignItems: 'center',
    backgroundColor: 'white',
    justifyContent: 'flex-end',
    paddingLeft: 15,
    paddingRight: 15,
    height: 56
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
  command: {
    fontFamily: 'Courier',
    color: '#5D86B4',
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

const styles2 = {
  container: {
    ...commonStyles.flexBoxRow,
    ...commonStyles.noSelect,
    backgroundColor: globalColors.white,
    opacity: 0.9,
    width: '100%',
    height: 61,
    boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 15,
    paddingBottom: 18,
    paddingRight: 15,
    position: 'relative',
    zIndex: 1
  }
}
