import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as Data from '@/util/emoji'
import type {LayoutEvent} from '@/common-adapters/box'
import startCase from 'lodash/startCase'
import debounce from 'lodash/debounce'
import SkinTonePicker from './skin-tone-picker'
import EmojiPicker, {getSkinToneModifierStrIfAvailable} from '.'
import {emojiDataToRenderableEmoji, renderEmoji, type EmojiData, type RenderableEmoji} from '@/util/emoji'
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
      if (conversationIDKey !== C.Chat.noConversationIDKey && onPickAddToMessageOrdinal) {
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
  const rpc = C.useRPC(T.RPCChat.localPutReacjiSkinToneRpcPromise)
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
  const waiting = C.Waiting.useAnyWaiting(C.Chat.waitingKeyLoadingEmoji)
  const cidChanged = C.Chat.useCIDChanged(conversationIDKey, undefined, true)
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
    return !meta.teamname || C.Teams.getCanPerformByID(C.useTeamsState.getState(), meta.teamID).manageEmojis
  })
  return canManageEmoji
}

const WrapperMobile = (props: Props) => {
  const {filter, onChoose, setFilter, topReacjis} = useReacji(props)

  const setFilterTextChangedThrottled = C.useThrottledCallback(setFilter, 200)
  const {waiting, customEmojiGroups} = useCustomReacji(props.onlyTeamCustomEmoji, props.disableCustomEmoji)
  const [width, setWidth] = React.useState(0)
  const onLayout = React.useCallback((evt: LayoutEvent) => setWidth(evt.nativeEvent.layout.width), [setWidth])
  const {currentSkinTone, setSkinTone} = useSkinTone()
  const [skinTonePickerExpanded, setSkinTonePickerExpanded] = React.useState(false)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = navigateUp
  const navigateAppend = C.Chat.useChatNavigateAppend()
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
        <Kb.Box style={Kb.Styles.globalStyles.flexOne} />
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
  const navigateAppend = C.Chat.useChatNavigateAppend()
  const addEmoji = () => {
    props.onDidPick?.()
    navigateAppend(conversationIDKey => ({
      props: {conversationIDKey, teamID: T.Teams.noTeamID},
      selected: 'teamAddEmoji',
    }))
  }

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
        ...Kb.Styles.globalStyles.flexBoxColumn,
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
          flexShrink: 0,
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
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
      input: {
        borderBottomWidth: 1,
        borderColor: Kb.Styles.globalColors.black_10,
        borderRadius: 0,
        borderWidth: 0,
        padding: Kb.Styles.globalMargins.small,
      },
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
  const {hideFrequentEmoji, onlyTeamCustomEmoji, onPickAddToMessageOrdinal, pickKey} = props
  const updatePickerMap = usePickerState(s => s.dispatch.updatePickerMap)
  const onPickAction = React.useCallback(
    (emojiStr: string, renderableEmoji: RenderableEmoji) => {
      updatePickerMap(pickKey, {emojiStr, renderableEmoji})
    },
    [updatePickerMap, pickKey]
  )
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onDidPick = () => navigateUp()

  C.useOnMountOnce(() => {
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
