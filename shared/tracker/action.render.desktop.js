/* @flow */

import React, {Component} from 'react'
import {FlatButton} from 'material-ui'
import {Button, Text, Icon} from '../common-adapters'
import commonStyles from '../styles/common'
import {globalStyles, globalColorsDZ2} from '../styles/style-guide'
import {normal, checking, warning} from '../constants/tracker'
import flags from '../util/feature-flags'

import type {ActionProps} from './action.render'

export default class ActionRender extends Component {
  props: ActionProps;

  render () {
    if (flags.tracker2) {
      return this.render2()
    }
    return this.render1()
  }

  render1 () {
    const {username, state, loggedIn} = this.props
    const styles = styles1

    if (!loggedIn) {
      return this.render1LoggedOut(styles)
    } else if (state === checking || !username) {
      return this.render1Pending(styles, username)
    } else if (this.props.state === normal) {
      return this.render1Normal(styles, username)
    } else if (this.props.currentlyFollowing) {
      return this.render1Changed(styles)
    } else {
      return this.render1WarningNotFollowed(styles)
    }
  }

  render2 () {
    const {username, loggedIn} = this.props
    const styles = styles2

    if (!loggedIn) {
      return this.renderLoggedOut(styles, username)
    }

    switch (this.props.lastAction) {
      case 'followed':
      case 'refollowed':
      case 'unfollowed':
      case 'error':
        return this.renderClose(styles, username)
    }

    if (this.props.state !== normal) {
      if (this.props.currentlyFollowing) {
        return this.renderChanged(styles, username)
      }
    }

    return this.renderNormal(styles, username)
  }

  renderLoggedOut (styles: Object, username: string) {
    return (
      <div style={{...styles.loggedOutContainer}}>
        <div style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'space-between', alignItems: 'center'}}>
          <Icon type='terminal' style={{width: 29}}/>
          <div style={{textAlign: 'center'}}>
            <Text dz2 type='Terminal' inline>keybase login</Text>
            <Text dz2 type='BodySmall' inline> or </Text>
            <Text dz2 type='Terminal' inline>keybase signup</Text>
            <Text dz2 type='BodySmall' inline> from the terminal for more options.</Text>
          </div>
        </div>
        <div style={styles.closeContainer}>
          <Button dz2 style={styles.actionButton} type='Secondary' label='Close' onClick={() => this.props.onClose(username)} />
        </div>
      </div>
    )
  }

  renderClose (styles: Object, username: string) {
    return (
      <div style={{...styles2.container}}>
        <Button dz2 style={styles.actionButton} type='Secondary' label='Close' onClick={() => this.props.onClose(username)} />
      </div>
    )
  }

  renderNormal (styles: Object, username: string) {
    return (
      <div style={{...styles2.container}}>
        <Button waiting={this.props.waiting} dz2 style={styles.actionButton} type='Follow' label='Track' onClick={() => this.props.onFollow(username)} />
      </div>
    )
  }

  renderChanged (styles: Object, username: string) {
    return (
      <div style={{...styles2.container}}>
        <Button waiting={this.props.waiting} dz2 type='Unfollow' label='Ignore for 24 hrs' onClick={() => this.props.onUnfollow(username)} />
        <Button waiting={this.props.waiting} dz2 style={styles.actionButton} type='Follow' label='Accept' onClick={() => this.props.onRefollow(username)} />
      </div>
    )
  }

  render1Pending (styles: Object, username: ?string) {
    const text: string = username ? `Verifying ${username}'s identity` : 'Loading tracker information...'
    return (
      <div><Text style={{textAlign: 'center', paddingTop: 8}} type='Body'>{text}</Text></div>
    )
  }

  render1WarningNotFollowed (styles: Object) {
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

  render1Changed (styles: Object) {
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

  render1Normal (styles: any, username: string) {
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

  render1LoggedOut (styles: Object) {
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

export function calcFooterHeight (loggedIn: boolean): number {
  return loggedIn ? 62 : 151
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
    backgroundColor: globalColorsDZ2.white90,
    width: '100%',
    height: calcFooterHeight(true),
    boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 15,
    paddingBottom: 15,
    paddingRight: 15,
    position: 'relative',
    zIndex: 1
  },

  closeContainer: {
    ...commonStyles.flexBoxRow,
    ...commonStyles.noSelect,
    backgroundColor: globalColorsDZ2.white90,
    width: '100%',
    alignItems: 'center',
    marginTop: 15,
    justifyContent: 'flex-end'
  },

  actionButton: {
    width: 102,
    minWidth: 102,
    marginRight: 0
  },

  loggedOutContainer: {
    ...commonStyles.flexBoxColumn,
    backgroundColor: globalColorsDZ2.white,
    width: '100%',
    height: calcFooterHeight(false),
    boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 15,
    position: 'relative',
    zIndex: 1
  }
}
