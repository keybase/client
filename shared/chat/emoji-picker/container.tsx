import * as C from './../../constants'
import * as React from 'react'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import type {LayoutEvent} from './../../common-adapters/box'
import * as Constants from './../../constants/chat2'
import * as T from './../../constants/types'
import * as Teams from './../../constants/teams'
import * as Styles from './../../styles'
import * as Data from './../../util/emoji'
import startCase from 'lodash/startCase'
import debounce from 'lodash/debounce'
import SkinTonePicker from './skin-tone-picker'
import EmojiPicker, {getSkinToneModifierStrIfAvailable} from '.'
import {
  emojiDataToRenderableEmoji,
  renderEmoji,
  type EmojiData,
  type RenderableEmoji,
} from './../../util/emoji'
import useRPC from './../../util/use-rpc'
import * as RPCChatGen from './../../constants/types/rpc-chat-gen'
import {usePickerState, type PickKey} from './use-picker'

type Props = {
  disableCustomEmoji?: boolean
  hideFrequentEmoji?: boolean
  small?: boolean
  onlyTeamCustomEmoji?: boolean
  onDidPick?: () => void
  onPickAddToMessageOrdinal?: T.Chat.Ordinal
  onPickAction?: (emoji: string, renderableEmoji: RenderableEmoji) => void
}

type RoutableProps = {
  conversationIDKey: T.Chat.ConversationIDKey
  small?: boolean
  hideFrequentEmoji?: boolean
  onlyTeamCustomEmoji?: boolean
  pickKey: PickKey
  onPickAddToMessageOrdinal?: T.Chat.Ordinal
}

const useReacji = ({onDidPick, onPickAction, onPickAddToMessageOrdinal}: Props) => {
  const topReacjis = C.useChatState(s => s.userReacjis.topReacjis)
  const [filter, setFilter] = React.useState('')
  const toggleMessageReaction = C.useChatContext(s => s.dispatch.toggleMessageReaction)
  const conversationIDKey = C.useChatContext(s => s.id)
  const onChoose = React.useCallback(
    (emoji: string, renderableEmoji: RenderableEmoji) => {
      if (conversationIDKey !== C.noConversationIDKey && onPickAddToMessageOrdinal) {
        toggleMessageReaction(onPickAddToMessageOrdinal, emoji)
      }
      onPickAction?.(emoji, renderableEmoji)
      onDidPick?.()
    },
    [toggleMessageReaction, conversationIDKey, onDidPick, onPickAction, onPickAddToMessageOrdinal]
  )
  return {
    filter,
    onChoose,
    setFilter,
    topReacjis,
  }
}

const useSkinTone = () => {
  const currentSkinTone = T.Chat.EmojiSkinToneFromRPC(C.useChatState(s => s.userReacjis.skinTone))
  const rpc = useRPC(RPCChatGen.localPutReacjiSkinToneRpcPromise)
  const updateUserReacjis = C.useChatState(s => s.dispatch.updateUserReacjis)
  const setSkinTone = (emojiSkinTone: undefined | T.Chat.EmojiSkinTone) => {
    rpc(
      [
        {
          skinTone: T.Chat.EmojiSkinToneToRPC(emojiSkinTone),
        },
      ],
      res => updateUserReacjis(res),
      err => {
        throw err
      }
    )
  }
  return {currentSkinTone, setSkinTone}
}

const useCustomReacji = (onlyInTeam: boolean | undefined, disabled?: boolean) => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const customEmojiGroups = C.useChatState(s => s.userEmojis)
  const waiting = Container.useAnyWaiting(Constants.waitingKeyLoadingEmoji)
  const cidChanged = C.useCIDChanged(conversationIDKey, undefined, true)
  const [lastOnlyInTeam, setLastOnlyInTeam] = React.useState(onlyInTeam)
  const [lastDisabled, setLastDisabled] = React.useState(disabled)
  const fetchUserEmoji = C.useChatState(s => s.dispatch.fetchUserEmoji)

  if (cidChanged || lastOnlyInTeam !== onlyInTeam || lastDisabled !== disabled) {
    setLastOnlyInTeam(onlyInTeam)
    setLastDisabled(disabled)
    if (!disabled) {
      fetchUserEmoji(conversationIDKey, onlyInTeam)
    }
  }

  return disabled ? {customEmojiGroups: undefined, waiting: false} : {customEmojiGroups, waiting}
}

const useCanManageEmoji = () => {
  const canManageEmoji = C.useChatContext(s => {
    const meta = s.meta
    // TODO not reactive
    return !meta.teamname || Teams.getCanPerformByID(C.useTeamsState.getState(), meta.teamID).manageEmojis
  })
  return canManageEmoji
}

const WrapperMobile = (props: Props) => {
  const {filter, onChoose, setFilter, topReacjis} = useReacji(props)

  const setFilterTextChangedThrottled = Container.useThrottledCallback(setFilter, 200)
  const {waiting, customEmojiGroups} = useCustomReacji(props.onlyTeamCustomEmoji, props.disableCustomEmoji)
  const [width, setWidth] = React.useState(0)
  const onLayout = React.useCallback(
    (evt: LayoutEvent) => evt.nativeEvent && setWidth(evt.nativeEvent.layout.width),
    [setWidth]
  )
  const {currentSkinTone, setSkinTone} = useSkinTone()
  const [skinTonePickerExpanded, setSkinTonePickerExpanded] = React.useState(false)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = navigateUp
  const navigateAppend = C.useChatNavigateAppend()
  const addEmoji = React.useCallback(
    () =>
      navigateAppend(conversationIDKey => ({
        props: {conversationIDKey, teamID: T.Teams.noTeamID},
        selected: 'teamAddEmoji',
      })),
    [navigateAppend]
  )
  const canManageEmoji = useCanManageEmoji()

  return (
    <Kb.Box2
      direction="vertical"
      onLayout={onLayout}
      fullWidth={true}
      fullHeight={true}
      style={styles.contain}
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">
        <Kb.ClickableBox onClick={onCancel} style={styles.cancelContainerMobile}>
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
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.footerContainer}>
        <SkinTonePicker
          currentSkinTone={currentSkinTone}
          onExpandChange={setSkinTonePickerExpanded}
          setSkinTone={setSkinTone}
        />
        <Kb.Box style={Styles.globalStyles.flexOne} />
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

export const EmojiPickerDesktop = (props: Props) => {
  const {filter, onChoose, setFilter, topReacjis} = useReacji(props)
  const {currentSkinTone, setSkinTone} = useSkinTone()
  const [hoveredEmoji, setHoveredEmoji] = React.useState<EmojiData>(Data.defaultHoverEmoji as any)
  const {waiting, customEmojiGroups} = useCustomReacji(props.onlyTeamCustomEmoji, props.disableCustomEmoji)
  const canManageEmoji = useCanManageEmoji()
  const navigateAppend = C.useChatNavigateAppend()
  const addEmoji = () => {
    props.onDidPick?.()
    navigateAppend(conversationIDKey => ({
      props: {conversationIDKey, teamID: T.Teams.noTeamID},
      selected: 'teamAddEmoji',
    }))
  }

  return (
    <Kb.Box
      style={Styles.collapseStyles([
        styles.containerDesktop,
        styles.contain,
        props.small && styles.containerDesktopSmall,
      ])}
      onClick={(e: any) => e.stopPropagation()}
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
          onChange={debounce(setFilter, 200)}
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
          style={styles.footerContainer}
          gap="small"
        >
          {renderEmoji({
            emoji: emojiDataToRenderableEmoji(
              hoveredEmoji,
              getSkinToneModifierStrIfAvailable(hoveredEmoji, currentSkinTone),
              currentSkinTone
            ),
            showTooltip: false,
            size: 36,
          })}
          {hoveredEmoji.teamname ? (
            <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexOne}>
              <Kb.Text type="BodyBig" lineClamp={1}>
                {':' + hoveredEmoji.short_name + ':'}
              </Kb.Text>
              <Kb.Text type="BodySmall" lineClamp={1}>
                from <Kb.Text type="BodySmallSemibold">{hoveredEmoji.teamname}</Kb.Text>
              </Kb.Text>
            </Kb.Box2>
          ) : (
            <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexOne}>
              <Kb.Text type="BodyBig" lineClamp={1}>
                {startCase(hoveredEmoji.name?.toLowerCase() ?? hoveredEmoji.short_name ?? '')}
              </Kb.Text>
              <Kb.Text type="BodySmall" lineClamp={1}>
                {hoveredEmoji.short_names?.map(sn => `:${sn}:`).join('  ')}
              </Kb.Text>
            </Kb.Box2>
          )}
          {canManageEmoji && (
            <Kb.Button mode="Secondary" label="Add emoji" onClick={addEmoji} style={styles.addEmojiButton} />
          )}
        </Kb.Box2>
      )}
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      addEmojiButton: Styles.platformStyles({
        isElectron: {
          width: 88,
        },
      }),
      cancelContainerMobile: {
        paddingBottom: Styles.globalMargins.tiny,
        paddingLeft: Styles.globalMargins.small,
        paddingTop: Styles.globalMargins.tiny,
      },
      contain: Styles.platformStyles({
        isElectron: {
          contain: 'content',
        },
      }),
      containerDesktop: {
        ...Styles.globalStyles.flexBoxColumn,
        backgroundColor: Styles.globalColors.white,
        height: 561,
        maxWidth: 336,
        minHeight: 561,
        width: 336,
      },
      containerDesktopSmall: {
        height: 250,
        minHeight: 250,
      },
      footerContainer: Styles.platformStyles({
        common: {
          flexShrink: 0,
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
        },
        isElectron: {
          backgroundColor: Styles.globalColors.blueGrey,
          height: Styles.globalMargins.xlarge + Styles.globalMargins.xtiny,
        },
        isMobile: {
          backgroundColor: Styles.globalColors.blueGrey,
          height: Styles.globalMargins.mediumLarge + Styles.globalMargins.small,
        },
      }),
      input: {
        borderBottomWidth: 1,
        borderColor: Styles.globalColors.black_10,
        borderRadius: 0,
        borderWidth: 0,
        padding: Styles.globalMargins.small,
      },
      searchFilter: Styles.platformStyles({
        isMobile: {
          flexGrow: 1,
          flexShrink: 1,
        },
      }),
      topContainerDesktop: {
        padding: Styles.globalMargins.tiny,
      },
    }) as const
)

const Routable = (props: RoutableProps) => {
  const small = props.small
  const {hideFrequentEmoji, onlyTeamCustomEmoji, onPickAddToMessageOrdinal, pickKey} = props
  const updatePickerMap = usePickerState(s => s.dispatch.updatePickerMap)
  const onPickAction = React.useCallback(
    (emojiStr: string, renderableEmoji: RenderableEmoji) => {
      if (!pickKey) {
        throw new Error('Missing pickKey')
      }
      updatePickerMap(pickKey, {emojiStr, renderableEmoji})
    },
    [updatePickerMap, pickKey]
  )
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onDidPick = () => navigateUp()

  Container.useOnMountOnce(() => {
    Kb.keyboardDismiss()
  })

  return (
    <WrapperMobile
      small={small}
      onPickAction={onPickAction}
      onPickAddToMessageOrdinal={onPickAddToMessageOrdinal}
      onDidPick={onDidPick}
      hideFrequentEmoji={hideFrequentEmoji}
      onlyTeamCustomEmoji={onlyTeamCustomEmoji}
    />
  )
}
export default Routable
