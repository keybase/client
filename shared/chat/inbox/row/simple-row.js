// @flow
import React, {PureComponent} from 'react'
import {Box, ClickableBox} from '../../../common-adapters'
import {globalStyles} from '../../../styles'
import {List} from 'immutable'

import type {ConversationIDKey} from '../../../constants/chat'

import {SimpleTopLine, FilteredTopLine} from './top-line'
import BottomLine from './bottom-line'
import {Avatars} from './avatars'

type SimpleProps = {
  backgroundColor: string,
  conversationIDKey: ConversationIDKey,
  hasUnread: boolean,
  isMuted: boolean,
  isSelected: boolean,
  onSelectConversation: () => void,
  participantNeedToRekey: boolean,
  participants: List<string>,
  rekeyInfo: any,
  showBold: boolean,
  snippet: string,
  subColor: string,
  timestamp: string,
  unreadCount: number,
  usernameColor: string,
  youNeedToRekey: boolean,
}

class SimpleRow extends PureComponent<void, SimpleProps, void> {
  render() {
    const props = this.props
    return (
      <ClickableBox onClick={props.onSelectConversation} style={{backgroundColor: props.backgroundColor}}>
        <Box style={{...rowContainerStyle, backgroundColor: props.backgroundColor}}>
          <Avatars
            backgroundColor={props.backgroundColor}
            isMuted={props.isMuted}
            isSelected={props.isSelected}
            participantNeedToRekey={props.participantNeedToRekey}
            participants={props.participants}
            youNeedToRekey={props.youNeedToRekey}
          />
          <Box
            style={{
              ...conversationRowStyle,
              backgroundColor: props.backgroundColor,
            }}
          >
            <SimpleTopLine
              hasUnread={props.hasUnread}
              participants={props.participants}
              showBold={props.showBold}
              subColor={props.subColor}
              timestamp={props.timestamp}
              usernameColor={props.usernameColor}
            />
            <BottomLine
              backgroundColor={props.backgroundColor}
              participantNeedToRekey={props.participantNeedToRekey}
              showBold={props.showBold}
              snippet={props.snippet}
              subColor={props.subColor}
              youNeedToRekey={props.youNeedToRekey}
            />
          </Box>
        </Box>
      </ClickableBox>
    )
  }
}

type FilteredProps = {
  backgroundColor: string,
  isMuted: boolean,
  isSelected: boolean,
  onSelectConversation: () => void,
  participantNeedToRekey: boolean,
  participants: List<string>,
  showBold: boolean,
  usernameColor: string,
  youNeedToRekey: boolean,
}

class FilteredRow extends PureComponent<void, FilteredProps, void> {
  render() {
    const props = this.props
    return (
      <ClickableBox onClick={props.onSelectConversation} style={{backgroundColor: props.backgroundColor}}>
        <Box style={{...rowContainerStyle, backgroundColor: props.backgroundColor}}>
          <Avatars
            backgroundColor={props.backgroundColor}
            isMuted={props.isMuted}
            isSelected={props.isSelected}
            participantNeedToRekey={props.participantNeedToRekey}
            participants={props.participants}
            youNeedToRekey={props.youNeedToRekey}
          />
          <Box
            style={{
              ...conversationRowStyle,
              backgroundColor: props.backgroundColor,
            }}
          >
            <FilteredTopLine
              participants={props.participants}
              showBold={props.showBold}
              usernameColor={props.usernameColor}
            />
          </Box>
        </Box>
      </ClickableBox>
    )
  }
}

const conversationRowStyle = {
  ...globalStyles.flexBoxColumn,
  flexGrow: 1,
  justifyContent: 'center',
  paddingLeft: 8,
  paddingRight: 8,
}

const rowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  flexShrink: 0,
  maxHeight: 56,
  minHeight: 56,
}

export {SimpleRow, FilteredRow}
