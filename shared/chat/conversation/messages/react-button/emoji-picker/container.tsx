import * as React from 'react'
import * as Container from '../../../../../util/container'
import * as Kb from '../../../../../common-adapters'
import {LayoutEvent} from '../../../../../common-adapters/box'
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as Styles from '../../../../../styles'
import SkinTonePicker from './skin-tone-picker'
import EmojiPicker from '.'

type Props = {
  onDidPick: () => void
  onPick:
    | ((emoji: string) => void)
    | {
        conversationIDKey: Types.ConversationIDKey
        ordinal: Types.Ordinal
      }
}

type RoutableProps = Container.RouteProps<{
  conversationIDKey: Types.ConversationIDKey
  onDidPick: () => void
  ordinal: Types.Ordinal
}>

const useReacji = ({onPick, onDidPick}: Props) => {
  const topReacjis = Container.useSelector(state => state.chat2.userReacjis.topReacjis)
  const [filter, setFilter] = React.useState('')
  const dispatch = Container.useDispatch()
  const onAddReaction = React.useCallback(
    (emoji: string) => {
      typeof onPick === 'function'
        ? onPick(emoji)
        : dispatch(
            Chat2Gen.createToggleMessageReaction({
              conversationIDKey: onPick.conversationIDKey,
              emoji,
              ordinal: onPick.ordinal,
            })
          )
      onDidPick()
    },
    [dispatch, onPick, onDidPick]
  )
  return {
    filter,
    onAddReaction,
    setFilter,
    topReacjis,
  }
}

const WrapperMobile = (props: Props) => {
  const {filter, onAddReaction, setFilter, topReacjis} = useReacji(props)
  const [width, setWidth] = React.useState(0)
  const onLayout = (evt: LayoutEvent) => evt.nativeEvent && setWidth(evt.nativeEvent.layout.width)
  const emojiSkinTone = Container.useSelector(state => state.chat2.emojiSkinTone)
  const dispatch = Container.useDispatch()
  const onCancel = () => dispatch(RouteTreeGen.createNavigateUp())
  return (
    <Kb.Box2
      direction="vertical"
      onLayout={onLayout}
      style={styles.alignItemsCenter}
      fullWidth={true}
      fullHeight={true}
    >
      <Kb.NewInput
        autoFocus={true}
        containerStyle={styles.input}
        decoration={
          <Kb.Text type="BodySemiboldLink" onClick={onCancel}>
            Cancel
          </Kb.Text>
        }
        placeholder="Search"
        icon="iconfont-search"
        onChangeText={filter => setFilter(filter)}
        textType="BodySemibold"
      />
      <EmojiPicker
        topReacjis={topReacjis}
        filter={filter}
        onChoose={emoji => onAddReaction(emoji)}
        width={width}
        skinTone={emojiSkinTone}
      />
    </Kb.Box2>
  )
}

export const EmojiPickerDesktop = (props: Props) => {
  const {filter, onAddReaction, setFilter, topReacjis} = useReacji(props)
  const emojiSkinTone = Container.useSelector(state => state.chat2.emojiSkinTone)
  return (
    <Kb.Box
      direction="vertical"
      style={styles.containerDesktop}
      onClick={e => e.stopPropagation()}
      gap="tiny"
    >
      <Kb.Box2
        direction="horizontal"
        gap="tiny"
        fullWidth={true}
        alignItems="center"
        style={styles.topContainer}
      >
        <Kb.SearchFilter
          focusOnMount={true}
          size="full-width"
          icon="iconfont-search"
          placeholderText="Search"
          onChange={str => setFilter(str)}
        />
        <SkinTonePicker />
      </Kb.Box2>
      <Kb.Box style={styles.emojiContainer}>
        <EmojiPicker
          topReacjis={topReacjis}
          filter={filter}
          onChoose={emoji => onAddReaction(emoji)}
          width={336}
          skinTone={emojiSkinTone}
        />
      </Kb.Box>
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      alignItemsCenter: {
        alignItems: 'center',
      },
      containerDesktop: {
        ...Styles.globalStyles.flexBoxColumn,
        backgroundColor: Styles.globalColors.white,
        //padding: Styles.globalMargins.tiny,
      },
      emojiContainer: {
        flex: 1,
        flexGrow: 1,
        height: 400,
        minHeight: 400,
        overflow: 'hidden',
        width: 336,
      },
      input: {
        borderBottomWidth: 1,
        borderColor: Styles.globalColors.black_10,
        borderRadius: 0,
        borderWidth: 0,
        padding: Styles.globalMargins.small,
      },
      topContainer: {
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
  const ordinal = Container.getRouteProps(routableProps, 'ordinal', Types.numberToOrdinal(0))
  const dispatch = Container.useDispatch()
  const navigateUp = () => dispatch(RouteTreeGen.createNavigateUp())
  return <WrapperMobile onPick={{conversationIDKey, ordinal}} onDidPick={navigateUp} />
}
