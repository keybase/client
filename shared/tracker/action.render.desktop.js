// @flow
import React, {PureComponent} from 'react'
import {Button, Text, Icon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {normal} from '../constants/tracker'

import type {ActionProps} from './action.render'

export default class ActionRender extends PureComponent<void, ActionProps, void> {
  render() {
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

  renderLoggedOut() {
    return (
      <div style={styleLoggedOutContainer}>
        <Icon type="icon-terminal-32" style={{marginBottom: -5, marginTop: -5}} />
        <div style={{textAlign: 'center'}}>
          <Text type="TerminalInline">keybase login</Text>
          <Text type="Body"> or </Text>
          <Text type="TerminalInline">keybase signup</Text>
          <Text type="Body"> from the terminal for more options.</Text>
        </div>
        <Button
          style={styleActionButton}
          type="Secondary"
          label="Close"
          onClick={() => this.props.onClose()}
        />
      </div>
    )
  }

  renderClose() {
    return (
      <div style={styleContainer}>
        <Button
          style={styleActionButton}
          type="Secondary"
          label="Close"
          onClick={() => this.props.onClose()}
        />
      </div>
    )
  }

  renderNormal() {
    return (
      <div style={styleContainer}>
        {!this.props.currentlyFollowing &&
          <Button
            waiting={this.props.waiting}
            style={{...styleActionButton, marginRight: 10}}
            type="Follow"
            label="Follow"
            onClick={() => this.props.onFollow()}
          />}
        {this.props.currentlyFollowing &&
          <Button
            style={{...styleActionButton, marginRight: 10}}
            type="Secondary"
            label="Close"
            onClick={() => this.props.onClose()}
          />}
        <Button
          style={styleChatButton}
          type="Primary"
          label="Start a Chat"
          onClick={() => this.props.onChat()}
        />
      </div>
    )
  }

  renderChanged() {
    return (
      <div style={styleContainer}>
        <Button
          waiting={this.props.waiting}
          type="Unfollow"
          label="Ignore for 24 hrs"
          onClick={() => this.props.onIgnore()}
        />
        <Button
          waiting={this.props.waiting}
          style={{...styleActionButton, marginLeft: 10}}
          type="Follow"
          label="Accept"
          onClick={() => this.props.onRefollow()}
        />
      </div>
    )
  }
}

export function calcFooterHeight(loggedIn: boolean): number {
  return loggedIn ? 62 : 151
}

const styleContainer = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.noSelect,
  backgroundColor: globalColors.white_90,
  width: '100%',
  height: calcFooterHeight(true),
  boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.15)',
  alignItems: 'center',
  justifyContent: 'center',
  padding: globalMargins.small,
  position: 'relative',
  zIndex: 1,
}

const styleActionButton = {
  width: 102,
  minWidth: 102,
}

const styleChatButton = {
  marginLeft: globalMargins.xtiny,
}

const styleLoggedOutContainer = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  width: '100%',
  height: calcFooterHeight(false),
  boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.15)',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: globalMargins.small,
  position: 'relative',
  zIndex: 1,
}
