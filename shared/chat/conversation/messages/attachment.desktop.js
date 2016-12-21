// @flow
import * as Constants from '../../../constants/chat'
import React, {PureComponent} from 'react'
import {Avatar, Box, Icon, Text} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import {withHandlers} from 'recompose'

import type {Props} from './attachment'

const _marginColor = (followState) => ({
  'You': globalColors.white,
  'Following': globalColors.green2,
  'NotFollowing': globalColors.blue,
  'Broken': globalColors.red,
}[followState])

const colorForAuthor = (followState: Constants.FollowState) => {
  if (followState === 'You') {
    return globalColors.black_75
  } else {
    return _marginColor(followState)
  }
}

// TODO abstract this part so it is the same as message text
class _AttachmentMessage extends PureComponent<void, Props & {onIconClick: (event: any) => void}, void> {
  render () {
    const {message, style, includeHeader, isFirstNewMessage, onLoadAttachment, onOpenInFileUI, onIconClick} = this.props
    const {downloadedPath} = message
    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, ...(isFirstNewMessage ? stylesFirstNewMessage : null), ...style}} className='message'>
        <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
          <Box style={{width: 2, marginRight: globalMargins.tiny, alignSelf: 'stretch', backgroundColor: _marginColor(message.followState)}} />
          <Box style={{...globalStyles.flexBoxRow, flex: 1, paddingTop: (includeHeader ? globalMargins.tiny : 0)}}>
            {includeHeader
              ? <Avatar size={24} username={message.author} style={{marginRight: globalMargins.tiny}} />
              : <Box style={{width: 32}} />}
            <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
              {includeHeader && <Text type='BodySmallSemibold' style={{color: colorForAuthor(message.followState), ...(message.followState === 'You' ? globalStyles.italic : null)}}>{message.author}</Text>}
              <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
                {!message.downloadedPath &&
                  <Text type='Body' style={{marginTop: globalMargins.xtiny, flex: 1}} onClick={() => onLoadAttachment(message.messageID, message.filename)}>
                    Click to download: {message.title} - {message.filename}
                  </Text>}
                {!!downloadedPath &&
                  <Text type='Body' style={{marginTop: globalMargins.xtiny, flex: 1}} onClick={() => onOpenInFileUI(downloadedPath)}>
                    Show downloaded file.
                  </Text>}
                {!!message.previewPath && message.previewType === 'Image' && <Box style={{marginTop: globalMargins.xtiny, flex: 1}}><img src={message.previewPath} /></Box>}
                <div className='action-button'>
                  <Icon type='iconfont-ellipsis' style={{marginLeft: globalMargins.tiny, marginRight: globalMargins.tiny}} onClick={onIconClick} />
                </div>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }
}

export default withHandlers({
  onIconClick: (props: Props) => event => {
    props.onAction(props.message, event)
  },
})(_AttachmentMessage)

const stylesFirstNewMessage = {
  borderTop: `solid 1px ${globalColors.orange}`,
}
