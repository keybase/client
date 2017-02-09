// @flow
// import React from 'react'
// import {Box, Text, NativeScrollView, Icon, ClickableBox} from '../../common-adapters/index.native'
// import {globalStyles, globalColors} from '../../styles'

import type {Props} from './'
// import type {InboxState, RekeyInfo, ConversationIDKey} from '../../constants/chat'

// const AddNewRow = ({onNewChat}: Props) => (
  // <Box
    // style={{...globalStyles.flexBoxRow, alignItems: 'center', flexShrink: 0, justifyContent: 'center', minHeight: 48}}>
    // <ClickableBox style={{...globalStyles.flexBoxColumn}} onClick={onNewChat}>
      // <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', justifyContent: 'center'}}>
        // <Icon type='iconfont-new' style={{color: globalColors.blue, marginRight: 9}} />
        // <Text type='BodyBigLink'>New chat</Text>
      // </Box>
    // </ClickableBox>
  // </Box>
// )

// type RowProps = Props & {conversation: InboxState, unreadCount: number, rekeyInfos: Map<ConversationIDKey, RekeyInfo>}

// const Row = (props: RowProps) => (
  // <Text type='Body'>{props.conversation.get('participants').toArray()}</Text>
// )

const ConversationList = (props: Props) => (
  null
  // <Box style={{...globalStyles.flexBoxColumn, flex: 1, backgroundColor: globalColors.darkBlue4}}>
    // <AddNewRow {...props} />
    // <NativeScrollView style={{...globalStyles.flexBoxColumn, flex: 1}}>
      // {props.inbox.map(conversation => <Row {...props} unreadCount={props.conversationUnreadCounts.get(conversation.get('conversationIDKey'))} key={conversation.get('conversationIDKey')} conversation={conversation} />)}
    // </NativeScrollView>
  // </Box>
)

export default ConversationList
