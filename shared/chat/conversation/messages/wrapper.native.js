// @flow
import React, {PureComponent} from 'react'
import {Avatar, Box, Icon, Text} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import {withHandlers} from 'recompose'
import {marginColor, colorForAuthor} from './shared'
import Retry from './retry'

import type {Props} from './wrapper'

type MessageProps = Props & {onRetry: () => void}

class MessageWrapper extends PureComponent<void, MessageProps, void> {
  render () {
    const {children, message, style, includeHeader, isFirstNewMessage, onRetry, isSelected, you, followingMap, metaDataMap} = this.props
    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, ...(isFirstNewMessage ? _stylesFirstNewMessage : null), ...(isSelected ? _stylesSelected : null), ...style}}>
        <Box style={_marginContainerStyle}>
          <Box style={{width: 3, marginRight: globalMargins.tiny, alignSelf: 'stretch', backgroundColor: marginColor(message.author, you, followingMap, metaDataMap)}} />
          <Box style={{...globalStyles.flexBoxRow, flex: 1, paddingTop: (includeHeader ? globalMargins.tiny : 0)}}>
            {includeHeader
              ? <Avatar size={32} username={message.author} style={_avatarStyle} />
              : <Box style={_noHeaderStyle} />}
            <Box style={_bodyContainerStyle}>
              {includeHeader && <Text type='BodySmallSemibold' style={{color: colorForAuthor(message.author, you, followingMap, metaDataMap), ...(message.author === you ? globalStyles.italic : null), marginBottom: 2}}>{message.author}</Text>}
              <Box style={_textContainerStyle}>
                <Box style={_childrenWrapStyle}>
                  {children}
                  {message.type === 'Text' && message.editedCount > 0 && <Text type='BodySmall' style={_editedStyle}>EDITED</Text>}
                </Box>
                <Box className='action-button'>
                  {message.senderDeviceRevokedAt && <Icon type='iconfont-exclamation' style={_exclamationStyle} />}
                </Box>
              </Box>
              {message.messageState === 'failed' && <Retry onRetry={onRetry} />}
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }
}

const _childrenWrapStyle = {
  flex: 1,
  ...globalStyles.flexBoxColumn,
}

const _stylesFirstNewMessage = {
  borderTop: `solid 1px ${globalColors.orange}`,
}

const _stylesSelected = {
  backgroundColor: `${globalColors.black_05}`,
}

const _exclamationStyle = {
  fontSize: 14,
  color: globalColors.blue,
}

const _textContainerStyle = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  marginBottom: globalMargins.xtiny,
}

const _marginContainerStyle = {
  ...globalStyles.flexBoxRow,
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
}

const _editedStyle = {
  color: globalColors.black_20,
}

export default withHandlers({
  onRetry: (props: Props) => () => {
    props.message.outboxID && props.onRetry(props.message.outboxID)
  },
})(MessageWrapper)
