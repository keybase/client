// @flow
import React, {PureComponent} from 'react'
import {Avatar, Box, Icon, NativeTouchableHighlight, Text} from '../../../common-adapters/index.native'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import {withHandlers} from 'recompose'
import {marginColor, colorForAuthor} from './shared'
import Failure from './failure'

import type {Props} from './wrapper'

type MessageProps = Props & {onRetry: () => void, onShowEditor: () => void}

class MessageWrapper extends PureComponent<void, MessageProps, void> {
  render () {
    const {children, message, style, includeHeader, isFirstNewMessage, onAction, onRetry, onShowEditor, isSelected, you, followingMap, metaDataMap} = this.props
    return (
      <NativeTouchableHighlight onLongPress={(event) => onAction(message, event)} underlayColor={globalColors.black_10}>
        <Box style={{...globalStyles.flexBoxColumn, flex: 1, ...(isFirstNewMessage ? _stylesFirstNewMessage : null), ...(isSelected ? _stylesSelected : _stylesUnselected), ...style}}>
          <Box style={_marginContainerStyle}>
            <Box style={{alignSelf: 'stretch', backgroundColor: marginColor(message.author, you, followingMap, metaDataMap), marginRight: globalMargins.tiny, width: 3}} />
            <Box style={{...globalStyles.flexBoxRow, flex: 1, paddingTop: (includeHeader ? globalMargins.tiny : 0), backgroundColor: globalColors.white}}>
              {includeHeader
                ? <Avatar size={32} username={message.author} style={_avatarStyle} />
                : <Box style={_noHeaderStyle} />}
              <Box style={_bodyContainerStyle}>
                {includeHeader && <Text type='BodySmallSemibold' style={{color: colorForAuthor(message.author, you, followingMap, metaDataMap), ...(message.author === you ? globalStyles.italic : null), marginBottom: 2, backgroundColor: globalColors.white}}>{message.author}</Text>}
                <Box style={_textContainerStyle}>
                  <Box style={_childrenWrapStyle}>
                    {children}
                    {message.type === 'Text' && message.editedCount > 0 && <Text type='BodySmall' style={_editedStyle}>EDITED</Text>}
                  </Box>
                  <Box className='action-button'>
                    {message.senderDeviceRevokedAt && <Icon type='iconfont-exclamation' style={_exclamationStyle} />}
                  </Box>
                </Box>
                {message.messageState === 'failed' && <Failure failureDescription={message.failureDescription} onRetry={onRetry} onShowEditor={onShowEditor} />}
              </Box>
            </Box>
          </Box>
        </Box>
      </NativeTouchableHighlight>
    )
  }
}

const _childrenWrapStyle = {
  flex: 1,
  ...globalStyles.flexBoxColumn,
}

const _stylesFirstNewMessage = {
  borderTopColor: globalColors.orange,
  borderTopWidth: 1,
}

const _stylesSelected = {
  backgroundColor: globalColors.black_05,
}

const _stylesUnselected = {
  backgroundColor: globalColors.white,
}

const _exclamationStyle = {
  color: globalColors.blue,
  fontSize: 14,
  marginRight: globalMargins.tiny,
}

const _textContainerStyle = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  marginBottom: globalMargins.xtiny,
}

const _marginContainerStyle = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.white,
  flex: 1,
}

const _bodyContainerStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const _noHeaderStyle = {
  width: 40,
}

const _avatarStyle = {
  marginRight: globalMargins.tiny,
  backgroundColor: globalColors.white,
}

const _editedStyle = {
  color: globalColors.black_20,
}

export default withHandlers({
  onRetry: (props: Props) => () => {
    props.message.outboxID && props.onRetry(props.message.outboxID)
  },
})(MessageWrapper)
