import * as React from 'react'
import * as Container from '../../../../../util/container'
import * as Kb from '../../../../../common-adapters'
import {LayoutEvent} from '../../../../../common-adapters/box'
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import * as TeamsTypes from '../../../../../constants/types/teams'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as RPCChatGen from '../../../../../constants/types/rpc-chat-gen'
import * as Styles from '../../../../../styles'
import * as Data from './data'
import debounce from 'lodash/debounce'
import startCase from 'lodash/startCase'
import SkinTonePicker from './skin-tone-picker'
import EmojiPicker, {addSkinToneIfAvailable} from '.'
import {EmojiData} from '../../../../../util/emoji'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  onDidPick?: () => void
  onPickAddToMessageOrdinal?: Types.Ordinal
  onPickAction?: (emoji: string) => void
}

type RoutableProps = Container.RouteProps<Props>

const useReacji = ({conversationIDKey, onDidPick, onPickAction, onPickAddToMessageOrdinal}: Props) => {
  const topReacjis = Container.useSelector(state => state.chat2.userReacjis.topReacjis)
  const [filter, setFilter] = React.useState('')
  const dispatch = Container.useDispatch()
  const onAddReaction = React.useCallback(
    (emoji: string) => {
      if (conversationIDKey !== Constants.noConversationIDKey && onPickAddToMessageOrdinal) {
        dispatch(
          Chat2Gen.createToggleMessageReaction({
            conversationIDKey: conversationIDKey,
            emoji,
            ordinal: onPickAddToMessageOrdinal,
          })
        )
      }
      onPickAction?.(emoji)
      onDidPick?.()
    },
    [dispatch, conversationIDKey, onDidPick, onPickAction, onPickAddToMessageOrdinal]
  )
  return {
    filter,
    onAddReaction,
    setFilter,
    topReacjis,
  }
}

let lastSetSkinTone: undefined | Types.EmojiSkinTone = undefined
// This can only be used in one place at a time for now since when it's changed
// it doesn't cause other hook instances to update.
const useSkinTone = () => {
  const [currentSkinTone, _setSkinTone] = React.useState(lastSetSkinTone)
  const setSkinTone = React.useCallback(
    (skinTone: undefined | Types.EmojiSkinTone) => {
      lastSetSkinTone = skinTone
      _setSkinTone(skinTone)
    },
    [_setSkinTone]
  )
  return {currentSkinTone, setSkinTone}
}
const useCustomReacji = (conversationIDKey: Types.ConversationIDKey) => {
  const getUserEmoji = Container.useRPC(RPCChatGen.localUserEmojisRpcPromise)
  const [customEmojiGroups, setCustomEmojiGroups] = React.useState<RPCChatGen.EmojiGroup[]>([])
  const [waiting, setWaiting] = React.useState(true)

  React.useEffect(() => {
    setWaiting(true)
    getUserEmoji(
      [
        {
          convID:
            conversationIDKey !== Constants.noConversationIDKey
              ? Types.keyToConversationID(conversationIDKey)
              : null,
          opts: {
            getAliases: true,
            getCreationInfo: false,
            onlyInTeam: false,
          },
        },
      ],
      result => {
        setCustomEmojiGroups(result.emojis.emojis ?? [])
        setWaiting(false)
      },
      _ => {
        setCustomEmojiGroups([])
        setWaiting(false)
      }
    )
  }, [conversationIDKey, getUserEmoji])

  return {customEmojiGroups, waiting}
}

const goToAddEmoji = (dispatch: Container.Dispatch, conversationIDKey: Types.ConversationIDKey) => {
  dispatch(
    RouteTreeGen.createNavigateAppend({
      path: [
        {
          props: {conversationIDKey, teamID: TeamsTypes.noTeamID},
          selected: 'teamAddEmoji',
        },
      ],
    })
  )
}

const WrapperMobile = (props: Props) => {
  const {filter, onAddReaction, setFilter, topReacjis} = useReacji(props)
  const {waiting, customEmojiGroups} = useCustomReacji(props.conversationIDKey)
  const [width, setWidth] = React.useState(0)
  const onLayout = (evt: LayoutEvent) => evt.nativeEvent && setWidth(evt.nativeEvent.layout.width)
  const {currentSkinTone, setSkinTone} = useSkinTone()
  const [skinTonePickerExpanded, setSkinTonePickerExpanded] = React.useState(false)
  const dispatch = Container.useDispatch()
  const onCancel = () => dispatch(RouteTreeGen.createNavigateUp())
  const addEmoji = () => goToAddEmoji(dispatch, props.conversationIDKey)
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
          onChange={debounce(setFilter, 200)}
          style={styles.searchFilter}
        />
      </Kb.Box2>
      <EmojiPicker
        topReacjis={topReacjis}
        filter={filter}
        onChoose={onAddReaction}
        customSections={customEmojiGroups}
        waitingForEmoji={waiting}
        width={width}
        skinTone={currentSkinTone}
      />
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.footerContainer}>
        <SkinTonePicker
          currentSkinTone={currentSkinTone}
          onExpandChange={setSkinTonePickerExpanded}
          setSkinTone={setSkinTone}
        />
        <Kb.Box style={Styles.globalStyles.flexOne} />
        {!skinTonePickerExpanded && (
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
  const {filter, onAddReaction, setFilter, topReacjis} = useReacji(props)
  const {currentSkinTone, setSkinTone} = useSkinTone()
  const [hoveredEmoji, setHoveredEmoji] = React.useState<EmojiData>(Data.defaultHoverEmoji)
  const {waiting, customEmojiGroups} = useCustomReacji(props.conversationIDKey)
  const dispatch = Container.useDispatch()
  const addEmoji = () => {
    props.onDidPick?.()
    goToAddEmoji(dispatch, props.conversationIDKey)
  }

  return (
    <Kb.Box
      style={Styles.collapseStyles([styles.containerDesktop, styles.contain])}
      onClick={e => e.stopPropagation()}
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
        topReacjis={topReacjis}
        filter={filter}
        onChoose={onAddReaction}
        onHover={setHoveredEmoji}
        width={336}
        skinTone={currentSkinTone}
        customSections={customEmojiGroups}
        waitingForEmoji={waiting}
      />
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        alignItems="center"
        style={styles.footerContainer}
        gap="small"
      >
        {hoveredEmoji.source ? (
          <Kb.CustomEmoji size="Big" src={hoveredEmoji.source} alias={hoveredEmoji.short_name} />
        ) : (
          <Kb.Emoji size={36} emojiName={addSkinToneIfAvailable(hoveredEmoji, currentSkinTone)} />
        )}
        <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexOne}>
          <Kb.Text type="BodyBig" lineClamp={1}>
            {hoveredEmoji.source
              ? hoveredEmoji.short_name
              : startCase(hoveredEmoji.name?.toLowerCase() ?? hoveredEmoji.short_name ?? '')}
          </Kb.Text>
          <Kb.Text type="BodySmall" lineClamp={1}>
            {hoveredEmoji.short_names?.map(sn => `:${sn}:`).join('  ')}
          </Kb.Text>
        </Kb.Box2>
        <Kb.Button mode="Secondary" label="Add emoji" onClick={addEmoji} style={styles.addEmojiButton} />
      </Kb.Box2>
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
        isMobile: {
          width: 104,
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
      footerContainer: Styles.platformStyles({
        common: {
          flexShrink: 0,
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
        },
        isElectron: {
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
    } as const)
)

export const Routable = (routableProps: RoutableProps) => {
  const conversationIDKey = Container.getRouteProps(
    routableProps,
    'conversationIDKey',
    Constants.noConversationIDKey
  )
  const onPickAction = Container.getRouteProps(routableProps, 'onPickAction', undefined)
  const onPickAddToMessageOrdinal = Container.getRouteProps(
    routableProps,
    'onPickAddToMessageOrdinal',
    undefined
  )
  const dispatch = Container.useDispatch()
  const navigateUp = () => dispatch(RouteTreeGen.createNavigateUp())
  const _onDidPick = Container.getRouteProps(routableProps, 'onDidPick', undefined)
  const onDidPick = _onDidPick
    ? () => {
        _onDidPick()
        navigateUp()
      }
    : navigateUp
  return (
    <WrapperMobile
      conversationIDKey={conversationIDKey}
      onPickAction={onPickAction}
      onPickAddToMessageOrdinal={onPickAddToMessageOrdinal}
      onDidPick={onDidPick}
    />
  )
}
