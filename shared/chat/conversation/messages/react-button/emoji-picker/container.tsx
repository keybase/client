import * as React from 'react'
import * as Container from '../../../../../util/container'
import * as Kb from '../../../../../common-adapters'
import {LayoutEvent} from '../../../../../common-adapters/box'
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import * as TeamsTypes from '../../../../../constants/types/teams'
import * as Teams from '../../../../../constants/teams'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as Styles from '../../../../../styles'
import * as Data from './data'
import startCase from 'lodash/startCase'
import debounce from 'lodash/debounce'
import SkinTonePicker from './skin-tone-picker'
import EmojiPicker, {getSkinToneModifierStrIfAvailable} from '.'
import {emojiDataToRenderableEmoji, renderEmoji, EmojiData, RenderableEmoji} from '../../../../../util/emoji'
import useRPC from '../../../../../util/use-rpc'
import * as RPCChatGen from '../../../../../constants/types/rpc-chat-gen'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  disableCustomEmoji?: boolean
  hideFrequentEmoji?: boolean
  small?: boolean
  onlyTeamCustomEmoji?: boolean
  onDidPick?: () => void
  onPickAddToMessageOrdinal?: Types.Ordinal
  onPickAction?: (emoji: string, renderableEmoji: RenderableEmoji) => void
}

type RoutableProps = Container.RouteProps<Props>

const useReacji = ({conversationIDKey, onDidPick, onPickAction, onPickAddToMessageOrdinal}: Props) => {
  const topReacjis = Container.useSelector(state => state.chat2.userReacjis.topReacjis)
  const [filter, setFilter] = React.useState('')
  const dispatch = Container.useDispatch()
  const onChoose = React.useCallback(
    (emoji: string, renderableEmoji: RenderableEmoji) => {
      if (conversationIDKey !== Constants.noConversationIDKey && onPickAddToMessageOrdinal) {
        dispatch(
          Chat2Gen.createToggleMessageReaction({
            conversationIDKey: conversationIDKey,
            emoji,
            ordinal: onPickAddToMessageOrdinal,
          })
        )
      }
      onPickAction?.(emoji, renderableEmoji)
      onDidPick?.()
    },
    [dispatch, conversationIDKey, onDidPick, onPickAction, onPickAddToMessageOrdinal]
  )
  return {
    filter,
    onChoose,
    setFilter,
    topReacjis,
  }
}

const useSkinTone = () => {
  const currentSkinTone = Types.EmojiSkinToneFromRPC(
    Container.useSelector(state => state.chat2.userReacjis.skinTone)
  )
  const dispatch = Container.useDispatch()
  const rpc = useRPC(RPCChatGen.localPutReacjiSkinToneRpcPromise)
  const setSkinTone = (emojiSkinTone: undefined | Types.EmojiSkinTone) => {
    rpc(
      [
        {
          skinTone: Types.EmojiSkinToneToRPC(emojiSkinTone),
        },
      ],
      res => dispatch(Chat2Gen.createUpdateUserReacjis({userReacjis: res})),
      err => {
        throw err
      }
    )
  }
  return {currentSkinTone, setSkinTone}
}

const useCustomReacji = (
  conversationIDKey: Types.ConversationIDKey,
  onlyInTeam: boolean | undefined,
  disabled?: boolean
) => {
  const customEmojiGroups = Container.useSelector(s => s.chat2.userEmojis)
  const waiting = Container.useSelector(s => Container.anyWaiting(s, Constants.waitingKeyLoadingEmoji))
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    !disabled && dispatch(Chat2Gen.createFetchUserEmoji({conversationIDKey, onlyInTeam}))
  }, [conversationIDKey, disabled, dispatch, onlyInTeam])
  return disabled ? {customEmojiGroups: undefined, waiting: false} : {customEmojiGroups, waiting}
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

const useCanManageEmoji = (conversationIDKey: Types.ConversationIDKey) => {
  const meta = Container.useSelector(s => Constants.getMeta(s, conversationIDKey))
  const canManageEmoji = Container.useSelector(
    s => !meta.teamname || Teams.getCanPerformByID(s, meta.teamID).manageEmojis
  )
  return canManageEmoji
}

const WrapperMobile = (props: Props) => {
  const {filter, onChoose, setFilter, topReacjis} = useReacji(props)
  const {waiting, customEmojiGroups} = useCustomReacji(
    props.conversationIDKey,
    props.onlyTeamCustomEmoji,
    props.disableCustomEmoji
  )
  const [width, setWidth] = React.useState(0)
  const onLayout = (evt: LayoutEvent) => evt.nativeEvent && setWidth(evt.nativeEvent.layout.width)
  const {currentSkinTone, setSkinTone} = useSkinTone()
  const [skinTonePickerExpanded, setSkinTonePickerExpanded] = React.useState(false)
  const dispatch = Container.useDispatch()
  const onCancel = () => dispatch(RouteTreeGen.createNavigateUp())
  const addEmoji = () => goToAddEmoji(dispatch, props.conversationIDKey)
  const canManageEmoji = useCanManageEmoji(props.conversationIDKey)

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
  const [hoveredEmoji, setHoveredEmoji] = React.useState<EmojiData>(Data.defaultHoverEmoji)
  const {waiting, customEmojiGroups} = useCustomReacji(
    props.conversationIDKey,
    props.onlyTeamCustomEmoji,
    props.disableCustomEmoji
  )
  const canManageEmoji = useCanManageEmoji(props.conversationIDKey)
  const dispatch = Container.useDispatch()
  const addEmoji = () => {
    props.onDidPick?.()
    goToAddEmoji(dispatch, props.conversationIDKey)
  }

  return (
    <Kb.Box
      style={Styles.collapseStyles([
        styles.containerDesktop,
        styles.contain,
        props.small && styles.containerDesktopSmall,
      ])}
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
          {renderEmoji(
            emojiDataToRenderableEmoji(
              hoveredEmoji,
              getSkinToneModifierStrIfAvailable(hoveredEmoji, currentSkinTone),
              currentSkinTone
            ),
            36,
            false
          )}
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
  const small = Container.getRouteProps(routableProps, 'small', undefined)
  const hideFrequentEmoji = Container.getRouteProps(routableProps, 'hideFrequentEmoji', undefined)
  const onlyTeamCustomEmoji = Container.getRouteProps(routableProps, 'onlyTeamCustomEmoji', undefined)
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
      small={small}
      onPickAction={onPickAction}
      onPickAddToMessageOrdinal={onPickAddToMessageOrdinal}
      onDidPick={onDidPick}
      hideFrequentEmoji={hideFrequentEmoji}
      onlyTeamCustomEmoji={onlyTeamCustomEmoji}
    />
  )
}
