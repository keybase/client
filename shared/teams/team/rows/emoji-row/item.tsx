import * as React from 'react'
import * as Types from '../../../../constants/types/teams'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Kb from '../../../../common-adapters'
import {formatTimeForConversationList} from '../../../../util/timestamp'
type OwnProps = {
  emoji: RPCChatTypes.Emoji
  firstItem: boolean
}

const ItemRow = ({emoji, firstItem}: OwnProps) => {
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
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
          <Kb.Text type="Body">{`:${emoji.alias}:`}</Kb.Text>
          {emoji.creationInfo && (
            <Kb.Text type="Body">{formatTimeForConversationList(emoji.creationInfo.time)}</Kb.Text>
          )}
          {emoji.creationInfo && (
            <Kb.NameWithIcon horizontal={true} username={emoji.creationInfo.username} size="small" />
          )}
          <Kb.Button icon="iconfont-ellipsis" mode="Secondary" type="Dim" />
        </Kb.Box2>
      }
      firstItem={firstItem}
    />
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        justifyContent: 'space-between',
      },
    } as const)
)

export default ItemRow
