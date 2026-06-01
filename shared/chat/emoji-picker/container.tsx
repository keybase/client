import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type {LayoutEvent} from '@/common-adapters/box'
import {useChatTeam} from '@/chat/conversation/team-hooks'
import startCase from 'lodash/startCase'
import SkinTonePicker from './skin-tone-picker'
import EmojiPicker, {getSkinToneModifierStrIfAvailable} from '.'
import {type RenderableEmoji, emojiData} from '@/common-adapters/emoji'
import {usePickerState, type PickKey} from './use-picker'
import {Keyboard} from 'react-native'
import {useUserEmoji} from '@/chat/user-emoji'
import {useCurrentSkinTone, useSetSkinTone, useTopReacjis} from '@/chat/user-reacjis'
import {
  toggleConversationMessageReaction,
  toggleConversationMessageReactionByID,
} from '@/chat/conversation/message-actions'
import {useConversationMessage, useConversationMeta} from '@/chat/conversation/data-hooks'

type Props = {
  conversationIDKey?: T.Chat.ConversationIDKey
  disableCustomEmoji?: boolean
  hideFrequentEmoji?: boolean
  small?: boolean
  onlyTeamCustomEmoji?: boolean
  onDidPick?: () => void
  onPickAddToMessageID?: T.Chat.MessageID
  onPickAction?: (emoji: string, renderableEmoji: RenderableEmoji) => void
}

type RoutableProps = {
  conversationIDKey?: T.Chat.ConversationIDKey
  small?: boolean
  hideFrequentEmoji?: boolean
  onlyTeamCustomEmoji?: boolean
  pickKey: PickKey
  onPickAddToMessageID?: T.Chat.MessageID
}

const useReacji = ({
  conversationIDKey = T.Chat.noConversationIDKey,
  onDidPick,
  onPickAction,
  onPickAddToMessageID,
}: Props) => {
  const topReacjis = useTopReacjis()
  const [filter, setFilter] = React.useState('')
  const message = useConversationMessage(
    conversationIDKey,
    onPickAddToMessageID ?? T.Chat.numberToMessageID(0)
  )
  const onChoose = (emoji: string, renderableEmoji: RenderableEmoji) => {
    if (conversationIDKey !== T.Chat.noConversationIDKey && onPickAddToMessageID) {
      if (message) {
        toggleConversationMessageReaction(conversationIDKey, message, emoji)
      } else {
        toggleConversationMessageReactionByID(conversationIDKey, onPickAddToMessageID, emoji)
      }
    }
    onPickAction?.(emoji, renderableEmoji)
    onDidPick?.()
  }
  return {
    filter,
    onChoose,
    setFilter,
    topReacjis,
  }
}

const useCustomReacji = (
  conversationIDKey: T.Chat.ConversationIDKey,
  onlyInTeam: boolean | undefined,
  disabled?: boolean
) => {
  const {emojiGroups: customEmojiGroups, loading: waiting} = useUserEmoji({
    conversationIDKey,
    disabled,
    onlyInTeam,
  })
  return {customEmojiGroups, waiting}
}

const useCanManageEmoji = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const meta = useConversationMeta(conversationIDKey)
  const {yourOperations} = useChatTeam(meta.teamID, meta.teamname)
  const canManageEmoji = !meta.teamname || yourOperations.manageEmojis
  return canManageEmoji
}

const WrapperMobile = (props: Props) => {
  const conversationIDKey = props.conversationIDKey ?? T.Chat.noConversationIDKey
  const {filter, onChoose, setFilter, topReacjis} = useReacji(props)

  const setFilterTextChangedThrottled = C.useThrottledCallback(setFilter, 200)
  const {waiting, customEmojiGroups} = useCustomReacji(
    conversationIDKey,
    props.onlyTeamCustomEmoji,
    props.disableCustomEmoji
  )
  const [width, setWidth] = React.useState(0)
  const onLayout = (evt: LayoutEvent) => setWidth(evt.nativeEvent.layout.width)
  const currentSkinTone = useCurrentSkinTone()
  const setSkinTone = useSetSkinTone()
  const [skinTonePickerExpanded, setSkinTonePickerExpanded] = React.useState(false)
  const onCancel = C.Router2.navigateUp
  const addEmoji = () =>
    C.Router2.navigateAppend({
      name: 'teamAddEmoji',
      params: {conversationIDKey, teamID: T.Teams.noTeamID},
    })
  const canManageEmoji = useCanManageEmoji(conversationIDKey)

  return (
    <Kb.Box2
      direction="vertical"
      onLayout={onLayout}
      fullWidth={true}
      fullHeight={true}
      style={styles.contain}
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">
        <Kb.ClickableBox direction="vertical" onClick={onCancel} style={styles.cancelContainerMobile}>
          <Kb.Text type="BodyBigLink">Cancel</Kb.Text>
        </Kb.ClickableBox>
        <Kb.SearchFilter
          focusOnMount={true}
          size="small"
          icon="iconfont-search"
          placeholderText="Search"
          onChange={setFilterTextChangedThrottled}
          style={styles.searchFilter}
        />
      </Kb.Box2>
      <EmojiPicker
        addEmoji={addEmoji}
        topReacjis={topReacjis}
        filter={filter}
        onChoose={onChoose}
        customEmojiGroups={customEmojiGroups}
        waitingForEmoji={waiting}
        width={width}
        skinTone={currentSkinTone}
        hideFrequentEmoji={props.hideFrequentEmoji ?? false}
      />
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" noShrink={true} style={styles.footerContainer}>
        <SkinTonePicker
          currentSkinTone={currentSkinTone}
          onExpandChange={setSkinTonePickerExpanded}
          setSkinTone={setSkinTone}
        />
        <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexOne} />
        {!props.small && !skinTonePickerExpanded && canManageEmoji && (
          <Kb.Button
            mode="Secondary"
            small={true}
            label="Add emoji"
            onClick={addEmoji}
            style={styles.addEmojiButton}
          />
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const EmojiPickerDesktopInner = (props: Props) => {
  const {onDidPick} = props
  const conversationIDKey = props.conversationIDKey ?? T.Chat.noConversationIDKey
  const {filter, onChoose, setFilter: _setFilter, topReacjis} = useReacji(props)
  const currentSkinTone = useCurrentSkinTone()
  const setSkinTone = useSetSkinTone()
  const [hoveredEmoji, setHoveredEmoji] = React.useState(emojiData.defaultHoverEmoji)
  const {waiting, customEmojiGroups} = useCustomReacji(
    conversationIDKey,
    props.onlyTeamCustomEmoji,
    props.disableCustomEmoji
  )
  const canManageEmoji = useCanManageEmoji(conversationIDKey)
  const addEmoji = () => {
    onDidPick?.()
    C.Router2.navigateAppend({
      name: 'teamAddEmoji',
      params: {conversationIDKey, teamID: T.Teams.noTeamID},
    })
  }

  const setFilter = C.useThrottledCallback(_setFilter, 200)

  return (
    <Kb.Box2
      direction="vertical"
      style={Kb.Styles.collapseStyles([
        styles.containerDesktop,
        styles.contain,
        props.small && styles.containerDesktopSmall,
      ])}
      gap="tiny"
    >
      <Kb.Box2
        direction="horizontal"
        gap="tiny"
        fullWidth={true}
        alignItems="center"
        style={styles.topContainerDesktop}
      >
        <Kb.SearchFilter
          focusOnMount={true}
          size="full-width"
          icon="iconfont-search"
          placeholderText="Search"
          onChange={setFilter}
        />
        <SkinTonePicker currentSkinTone={currentSkinTone} setSkinTone={setSkinTone} />
      </Kb.Box2>
      <EmojiPicker
        addEmoji={addEmoji}
        topReacjis={topReacjis}
        filter={filter}
        onChoose={onChoose}
        onHover={setHoveredEmoji}
        width={336}
        skinTone={currentSkinTone}
        customEmojiGroups={customEmojiGroups}
        waitingForEmoji={waiting}
        hideFrequentEmoji={props.hideFrequentEmoji ?? false}
      />
      {!props.small && (
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          alignItems="center"
          noShrink={true} style={styles.footerContainer}
          gap="small"
        >
          <Kb.Emoji
            emojiData={hoveredEmoji}
            skinToneModifier={getSkinToneModifierStrIfAvailable(hoveredEmoji, currentSkinTone)}
            skinToneKey={currentSkinTone}
            showTooltip={false}
            size={36}
          />
          {hoveredEmoji.teamname ? (
            <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexOne}>
              <Kb.Text type="BodyBig" lineClamp={1}>
                {':' + hoveredEmoji.short_name + ':'}
              </Kb.Text>
              <Kb.Text type="BodySmall" lineClamp={1}>
                from <Kb.Text type="BodySmallSemibold">{hoveredEmoji.teamname}</Kb.Text>
              </Kb.Text>
            </Kb.Box2>
          ) : (
            <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexOne}>
              <Kb.Text type="BodyBig" lineClamp={1}>
                {startCase(hoveredEmoji.name?.toLowerCase() ?? hoveredEmoji.short_name)}
              </Kb.Text>
              <Kb.Text type="BodySmall" lineClamp={1}>
                {hoveredEmoji.short_names.map(sn => `:${sn}:`).join('  ')}
              </Kb.Text>
            </Kb.Box2>
          )}
          {canManageEmoji && (
            <Kb.Button mode="Secondary" label="Add emoji" onClick={addEmoji} style={styles.addEmojiButton} />
          )}
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

export const EmojiPickerDesktop = EmojiPickerDesktopInner

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      addEmojiButton: Kb.Styles.platformStyles({
        isElectron: {
          width: 88,
        },
      }),
      cancelContainerMobile: {
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      contain: Kb.Styles.platformStyles({
        isElectron: {
          contain: 'content',
        },
      }),
      containerDesktop: {
        backgroundColor: Kb.Styles.globalColors.white,
        height: 561,
        maxWidth: 336,
        minHeight: 561,
        width: 336,
      },
      containerDesktopSmall: {
        height: 250,
        minHeight: 250,
      },
      footerContainer: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
        },
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.blueGrey,
          height: Kb.Styles.globalMargins.xlarge + Kb.Styles.globalMargins.xtiny,
        },
        isMobile: {
          backgroundColor: Kb.Styles.globalColors.blueGrey,
          height: Kb.Styles.globalMargins.mediumLarge + Kb.Styles.globalMargins.small,
        },
      }),
      searchFilter: Kb.Styles.platformStyles({
        isMobile: {
          flexGrow: 1,
          flexShrink: 1,
        },
      }),
      topContainerDesktop: {
        padding: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)

const Routable = (props: RoutableProps) => {
  const small = props.small
  const {hideFrequentEmoji, onlyTeamCustomEmoji, onPickAddToMessageID, pickKey} = props
  const updatePickerMap = usePickerState(s => s.dispatch.updatePickerMap)
  const onPickAction = (emojiStr: string, renderableEmoji: RenderableEmoji) => {
    updatePickerMap(pickKey, {emojiStr, renderableEmoji})
  }
  const onDidPick = C.Router2.navigateUp

  C.useOnMountOnce(() => {
    Keyboard.dismiss()
  })

  return (
    <WrapperMobile
      conversationIDKey={props.conversationIDKey}
      small={small}
      onPickAction={onPickAction}
      onPickAddToMessageID={onPickAddToMessageID}
      onDidPick={onDidPick}
      hideFrequentEmoji={hideFrequentEmoji}
      onlyTeamCustomEmoji={onlyTeamCustomEmoji}
    />
  )
}
export default Routable
