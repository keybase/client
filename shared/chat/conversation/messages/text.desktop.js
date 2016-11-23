// @flow
import React, {Component} from 'react'
import {Box, Button, Text, Avatar} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import * as Constants from '../../../constants/chat'
import type {TextMessage} from '../../../constants/chat'

import type {Props} from './text'

const _marginColor = (followState) => ({
  'You': globalColors.white,
  'Following': globalColors.green2,
  'NotFollowing': globalColors.blue,
  'Broken': globalColors.red,
}[followState])

const MessageText = ({message, style}: {message: TextMessage, style: Object}) => {
  const text = message.message.stringValue()
  switch (message.messageState) {
    case 'failed':
    case 'pending':
      return <Text type='Body' style={{color: globalColors.black_40, ...style}}>{text}</Text>
    case 'sent':
    default:
      return <Text style={style} type='Body'>{text}</Text>
  }
}

const colorForAuthor = (followState: Constants.FollowState) => {
  if (followState === 'You') {
    return globalColors.black_75
  } else {
    return _marginColor(followState)
  }
}

const Retry = ({onRetry}: {onRetry: () => void}) => (
  <Box>
    <Text type='BodySmall' style={{fontSize: 9, color: globalColors.red}}>{'┏(>_<)┓'}</Text>
    <Text type='BodySmall' style={{color: globalColors.red}}> Failed to send. </Text>
    <Text type='BodySmall' style={{color: globalColors.red, textDecoration: 'underline'}} onClick={onRetry}>Retry</Text>
  </Box>
)

type State = {
  hovered: boolean,
}

export default class MessageTextComponent extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      hovered: false,
    }
  }

  render () {
    const {message, style, includeHeader, onRetry, onAction} = this.props

    const buttonActionStyle = {
      display: (this.state.hovered ? 'block': 'none'),
      height: 20,
      lineHeight: '20px',
      marginLeft: 'auto',
    }

    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}} onMouseOver={() => this.setState({hovered: true})} onMouseOut={() => this.setState({hovered: false})}>
        <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
          <Box style={{width: 2, marginRight: globalMargins.tiny, alignSelf: 'stretch', backgroundColor: _marginColor(message.followState)}} />
          <Box style={{...globalStyles.flexBoxRow, flex: 1, paddingTop: (includeHeader ? globalMargins.tiny : 0)}}>
            {includeHeader
              ? <Avatar size={24} username={message.author} style={{marginRight: globalMargins.tiny}} />
              : <Box style={{width: 32}} />}
            <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
              {includeHeader && <Text type='BodySmallSemibold' style={{color: colorForAuthor(message.followState), ...(message.followState === 'You' ? globalStyles.italic : null)}}>{message.author}</Text>}
              <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
                <MessageText message={message} style={{marginTop: globalMargins.xtiny, flex: 1}} />
                <Button type='Custom' label='' more={true} small={true} onClick={onAction} style={buttonActionStyle} />
              </Box>
              {message.messageState === 'failed' && <Retry onRetry={onRetry} />}
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }
}
