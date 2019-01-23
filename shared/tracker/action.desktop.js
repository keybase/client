// @flow
import React, {PureComponent} from 'react'
import {Button, Text, Icon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins, desktopStyles} from '../styles'
import {normal} from '../constants/tracker'
import type {SimpleProofState} from '../constants/types/tracker'

type Props = {
  loggedIn: boolean,
  waiting: boolean,
  state: SimpleProofState,
  currentlyFollowing: boolean,
  username: string,
  myUsername: ?string,
  lastAction: ?('followed' | 'refollowed' | 'unfollowed' | 'error'),
  onChat: () => void,
  onClose: () => void,
  onIgnore: () => void,
  onFollow: () => void,
  onRefollow: () => void,
  onUnfollow: () => void,
}

export default class ActionRender extends PureComponent<Props> {
  render() {
    const {loggedIn} = this.props

    if (!loggedIn) {
      return this.renderLoggedOut()
    }

    switch (this.props.lastAction) {
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
        {!this.props.currentlyFollowing && this.props.myUsername !== this.props.username && (
          <Button
            waiting={this.props.waiting}
            style={{...styleActionButton, marginRight: globalMargins.tiny}}
            type="PrimaryGreen"
            label="Follow"
            onClick={() => this.props.onFollow()}
          />
        )}
        {(this.props.currentlyFollowing || this.props.myUsername === this.props.username) && (
          <Button
            style={{...styleActionButton, marginRight: globalMargins.tiny}}
            type="Secondary"
            label="Close"
            onClick={() => this.props.onClose()}
          />
        )}
        <Button style={styleChatButton} label="Chat" type="Primary" onClick={() => this.props.onChat()}>
          <Icon
            type="iconfont-chat"
            style={{
              marginRight: 8,
            }}
            color={globalColors.white}
          />
        </Button>
      </div>
    )
  }

  renderChanged() {
    return (
      <div style={styleContainer}>
        <Button
          waiting={this.props.waiting}
          type="Secondary"
          label="Ignore for 24 hrs"
          onClick={() => this.props.onIgnore()}
        />
        <Button
          waiting={this.props.waiting}
          style={{...styleActionButton, marginLeft: globalMargins.tiny}}
          type="PrimaryGreen"
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
  ...desktopStyles.boxShadow,
  ...desktopStyles.noSelect,
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.white_90,
  height: calcFooterHeight(true),
  justifyContent: 'center',
  padding: globalMargins.small,
  position: 'relative',
  width: '100%',
  zIndex: 1,
}

const styleActionButton = {
  minWidth: 102,
  width: 102,
}

const styleChatButton = {
  marginLeft: globalMargins.xtiny,
}

const styleLoggedOutContainer = {
  ...desktopStyles.boxShadow,
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.white,
  height: calcFooterHeight(false),
  justifyContent: 'space-between',
  padding: globalMargins.small,
  position: 'relative',
  width: '100%',
  zIndex: 1,
}
