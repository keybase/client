/* @flow */

import React, {Component} from 'react'
import {Button, Text, Icon} from '../common-adapters'
import commonStyles from '../styles/common'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {normal} from '../constants/tracker'

import type {ActionProps} from './action.render'

export default class ActionRender extends Component {
  props: ActionProps;

  render () {
    const {loggedIn} = this.props

    if (!loggedIn) {
      return this.renderLoggedOut()
    }

    switch (this.props.lastAction) {
      case 'followed':
      case 'refollowed':
      case 'unfollowed':
      case 'error':
        return this.renderClose()
    }

    if (this.props.state !== normal) {
      if (this.props.currentlyFollowing) {
        return this.renderChanged()
      }
    }

    return this.renderNormal()
  }

  renderLoggedOut () {
    return (
      <div style={styleLoggedOutContainer}>
        <div style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'space-between', alignItems: 'center'}}>
          <Icon type='terminal' style={{width: 29}} />
          <div style={{textAlign: 'center'}}>
            <Text type='Terminal' inline>keybase login</Text>
            <Text type='BodySmall' inline> or </Text>
            <Text type='Terminal' inline>keybase signup</Text>
            <Text type='BodySmall' inline> from the terminal for more options.</Text>
          </div>
        </div>
        <div style={styleCloseContainer}>
          <Button style={styleActionButton} type='Secondary' label='Close' onClick={() => this.props.onClose()} />
        </div>
      </div>
    )
  }

  renderClose () {
    return (
      <div style={styleContainer}>
        <Button style={styleActionButton} type='Secondary' label='Close' onClick={() => this.props.onClose()} />
      </div>
    )
  }

  renderNormal () {
    return (
      <div style={styleContainer}>
        {!this.props.currentlyFollowing &&
          <Button waiting={this.props.waiting} style={styleActionButton} type='Follow' label='Track' onClick={() => this.props.onFollow()} />}
        {this.props.currentlyFollowing &&
          <Button style={styleActionButton} type='Secondary' label='Close' onClick={() => this.props.onClose()} />}
      </div>
    )
  }

  renderChanged () {
    return (
      <div style={styleContainer}>
        <Button waiting={this.props.waiting} type='Unfollow' label='Ignore for 24 hrs' onClick={() => this.props.onIgnore()} />
        <Button waiting={this.props.waiting} style={styleActionButton} type='Follow' label='Accept' onClick={() => this.props.onRefollow()} />
      </div>
    )
  }
}

export function calcFooterHeight (loggedIn: boolean): number {
  return loggedIn ? 62 : 151
}

const styleContainer = {
  ...commonStyles.flexBoxRow,
  ...commonStyles.noSelect,
  backgroundColor: globalColors.white_90,
  width: '100%',
  height: calcFooterHeight(true),
  boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.15)',
  alignItems: 'center',
  justifyContent: 'flex-end',
  paddingTop: globalMargins.small,
  paddingBottom: globalMargins.small,
  paddingRight: globalMargins.small,
  position: 'relative',
  zIndex: 1,
}

const styleCloseContainer = {
  ...commonStyles.flexBoxRow,
  ...commonStyles.noSelect,
  backgroundColor: globalColors.white_90,
  width: '100%',
  alignItems: 'center',
  marginTop: globalMargins.small,
  justifyContent: 'flex-end',
}

const styleActionButton = {
  width: 102,
  minWidth: 102,
  marginRight: 0,
}

const styleLoggedOutContainer = {
  ...commonStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  width: '100%',
  height: calcFooterHeight(false),
  boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.15)',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: globalMargins.small,
  position: 'relative',
  zIndex: 1,
}
