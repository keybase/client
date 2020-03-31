import * as React from 'react'
import * as Types from '../../../../constants/types/teams'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Kb from '../../../../common-adapters'
import {formatTimeForConversationList} from '../../../../util/timestamp'
type OwnProps = {
  emoji: RPCChatTypes.Emoji
}

const ItemRow = ({emoji}: OwnProps) => {
  return (
    <Kb.ListItem2
      icon={
        emoji.source.typ === RPCChatTypes.EmojiLoadSourceTyp.httpsrv ? (
          <Kb.CustomEmoji size="Big" src={emoji.source.httpsrv} />
        ) : (
          <Kb.Emoji emojiName={emoji.source.str} size={32} />
        )
      }
      type="Large"
      body={
        <Kb.Box2 direction="horizontal">
          <Kb.Text type="Body">{`:${emoji.alias}:`}</Kb.Text>
          {emoji.creationInfo && (
            <Kb.Text type="Body">{formatTimeForConversationList(emoji.creationInfo.time)}</Kb.Text>
          )}
          {emoji.creationInfo && (
            <Kb.NameWithIcon horizontal={true} username={emoji.creationInfo.username} size="small" />
          )}
        </Kb.Box2>
      }
      firstItem={false}
    />
  )
}

export default ItemRow
