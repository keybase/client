import * as React from 'react'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Kb from '../../../../common-adapters'
import * as dateFns from 'date-fns'
import EmojiMenu from './emoji-menu'
type OwnProps = {
  emoji: RPCChatTypes.Emoji
}

const ItemRow = ({emoji}: OwnProps) => {
  const {showingPopup, setShowingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <EmojiMenu
      attachTo={attachTo}
      canManageEmoji={true}
      visible={showingPopup}
      onEditAlias={() => null}
      onAddAlias={() => null}
      onRemove={() => null}
      onHidden={() => setShowingPopup(false)}
    />
  ))

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
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          alignItems="center"
          style={styles.container}
          gap="small"
        >
          <Kb.Text type="Body" style={styles.alias}>{`:${emoji.alias}:`}</Kb.Text>
          {emoji.creationInfo && (
            <Kb.Text type="Body" style={styles.date}>
              {dateFns.format(emoji.creationInfo.time, 'EEE d MMM yyyy')}
            </Kb.Text>
          )}
          {emoji.creationInfo && (
            <Kb.NameWithIcon
              horizontal={true}
              username={emoji.creationInfo.username}
              size="small"
              avatarSize={24}
              containerStyle={styles.username}
            />
          )}
          <Kb.Box2 direction="horizontal">
            {popup}
            <Kb.Button
              icon="iconfont-ellipsis"
              mode="Secondary"
              type="Dim"
              onClick={() => setShowingPopup(!showingPopup)}
              ref={popupAnchor}
            />
          </Kb.Box2>
        </Kb.Box2>
      }
      firstItem={false}
    />
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      alias: {
        marginRight: 'auto',
      },
      container: {
        justifyContent: 'flex-end',
      },
      date: {
        maxWidth: 130,
        width: 130,
      },
      username: {
        maxWidth: 210,
        width: 210,
      },
    } as const)
)

export default ItemRow
