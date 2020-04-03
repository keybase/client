import * as React from 'react'
import * as TeamsTypes from '../../constants/types/teams'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as RPCChatGen from '../../constants/types/rpc-chat-gen'
import * as Container from '../../util/container'
import * as FsTypes from '../../constants/types/fs'
import * as ChatTypes from '../../constants/types/chat2'
import * as ChatConstants from '../../constants/chat2'
import * as EmojiPicker from '../../chat/conversation/messages/react-button/emoji-picker/container'
import {AliasInput, Modal} from './common'
import {pluralize} from '../../util/string'
import useRPC from '../../util/use-rpc'

type Props = {
  teamID: TeamsTypes.TeamID
}
type RoutableProps = Container.RouteProps<Props>

type ChosenEmoji = {
  emojiData: EmojiPicker.EmojiData // useful for custom emojis
  emojiStr: string // useful with stock emojis with skintones
}

export const AddAliasModal = (props: Props) => {
  const [emoji, setEmoji] = React.useState<ChosenEmoji | undefined>(undefined)
  return (
    <Modal
      bannerImage="icon-illustration-emoji-alias-460-96"
      title="Add alias"
      desktopHeight={395}
      footerButtonLabel="Add alias"
      footerButtonOnClick={() => {}}
      footerButtonWaiting={false}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} gap="small" style={styles.container}>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          <Kb.Text type="BodySemibold">Choose an existing emoji:</Kb.Text>
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="small">
            <SelectedEmoji chosen={emoji} />
            <ChooseEmoji
              onChoose={(emojiStr: string, emojiData: EmojiPicker.EmojiData) =>
                setEmoji({emojiData, emojiStr})
              }
            />
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          <Kb.Text type="BodySemibold">Enter an alias:</Kb.Text>
          <AliasInput error="this is an error" alias="blah" onChangeAlias={() => {}} small={false} />
        </Kb.Box2>
      </Kb.Box2>
    </Modal>
  )
}

type ChooseEmojiProps = {
  onChoose: (emojiStr: string, emojiData: EmojiPicker.EmojiData) => void
}
const ChooseEmoji = Styles.isMobile
  ? (props: ChooseEmojiProps) => {
      return null
    }
  : (props: ChooseEmojiProps) => {
      const {popup, popupAnchor, setShowingPopup, showingPopup, toggleShowingPopup} = Kb.usePopup(() => null)
      return <Kb.Button mode="Secondary" label="Choose emoji" onClick={() => {}} />
    }

type SelectedEmojiProps = {
  chosen?: ChosenEmoji
}

const SelectedEmoji = (props: SelectedEmojiProps) => {
  return (
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.emoji}>
      {props.chosen ? (
        props.chosen.emojiData.source ? (
          <Kb.CustomEmoji
            size="Medium"
            src={props.chosen.emojiData.source}
            alias={props.chosen.emojiData.short_name}
          />
        ) : (
          <Kb.Emoji size={singleEmojiWidth} emojiName={props.chosen.emojiStr} />
        )
      ) : (
        <Kb.Icon type="iconfont-emoji" fontSize={Styles.isMobile ? 20 : 16} />
      )}
    </Kb.Box2>
  )
}

const emojiWidthWithPadding = Styles.isMobile ? 40 : 32
const emojiPadding = 4
const singleEmojiWidth = emojiWidthWithPadding - 2 * emojiPadding

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexGrow,
      backgroundColor: Styles.globalColors.blueGrey,
    },
    isElectron: {
      padding: Styles.globalMargins.small,
    },
    isMobile: {
      ...Styles.globalStyles.flexGrow,
      ...Styles.padding(Styles.globalMargins.medium + Styles.globalMargins.xtiny, Styles.globalMargins.small),
    },
  }),
  emoji: {
    backgroundColor: Styles.globalColors.white,
    borderRadius: Styles.globalMargins.xtiny,
    height: emojiWidthWithPadding,
    width: emojiWidthWithPadding,
  },
}))

export default (routableProps: RoutableProps) => {
  const teamID = Container.getRouteProps(routableProps, 'teamID', ChatConstants.noConversationIDKey)
  return <AddAliasModal teamID={teamID} />
}
