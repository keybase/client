/* @flow */

import React, {Component} from 'react'
import {Button, Text, Icon} from '../common-adapters'
import commonStyles from '../styles/common'
import {globalStyles, globalColors} from '../styles/style-guide'
import {normal} from '../constants/tracker'

import type {ActionProps} from './action.render'

export default class ActionRender extends Component {
  props: ActionProps;

  render () {
    const {username, loggedIn} = this.props

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
            <Text type='Terminal' inline>keybase login</Text>
            <Text type='BodySmall' inline> or </Text>
            <Text type='Terminal' inline>keybase signup</Text>
            <Text type='BodySmall' inline> from the terminal for more options.</Text>
          </div>
        </div>
        <div style={styles.closeContainer}>
          <Button style={styles.actionButton} type='Secondary' label='Close' onClick={() => this.props.onClose(username)} />
        </div>
      </div>
    )
  }

  renderClose (styles: Object, username: string) {
    return (
      <div style={{...styles.container}}>
        <Button style={styles.actionButton} type='Secondary' label='Close' onClick={() => this.props.onClose(username)} />
      </div>
    )
  }

  renderNormal (styles: Object, username: string) {
    return (
      <div style={{...styles.container}}>
        {!this.props.currentlyFollowing &&
          <Button waiting={this.props.waiting} style={styles.actionButton} type='Follow' label='Track' onClick={() => this.props.onFollow(username)} />}
        {this.props.currentlyFollowing &&
          <Button style={styles.actionButton} type='Secondary' label='Close' onClick={() => this.props.onClose(username)} />}
      </div>
    )
  }

  renderChanged (styles: Object, username: string) {
    return (
      <div style={{...styles.container}}>
        <Button waiting={this.props.waiting} type='Unfollow' label='Ignore for 24 hrs' onClick={() => this.props.onClose(username)} />
        <Button waiting={this.props.waiting} style={styles.actionButton} type='Follow' label='Accept' onClick={() => this.props.onRefollow(username)} />
      </div>
    )
  }
}

export function calcFooterHeight (loggedIn: boolean): number {
  return loggedIn ? 62 : 151
}

const styles = {
  container: {
    ...commonStyles.flexBoxRow,
    ...commonStyles.noSelect,
    backgroundColor: globalColors.white90,
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
    backgroundColor: globalColors.white90,
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
    backgroundColor: globalColors.white,
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
