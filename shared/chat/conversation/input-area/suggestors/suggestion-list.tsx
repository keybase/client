import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import noop from 'lodash/noop'
import {BotCommandUpdateStatus} from './shared'

type Props<I> = {
  items: Array<I>
  keyExtractor?: (item: I, idx: number) => string
  renderItem: (index: number, item: I) => React.ReactElement
  // desktop only: height of a single rendered row, so the popup can be sized to
  // a whole number of rows instead of clipping the last one into a scroll area
  rowHeight: number
  selectedIndex: number
  style?: Kb.Styles.StylesCrossPlatform
  suggestBotCommandsUpdateStatus?: T.RPCChat.UIBotCommandsUpdateStatusTyp
}
import type {LegendListRef} from '@/common-adapters'
import {FlatList} from 'react-native'

const maxHeight = 224

const SuggestionList = <I,>(props: Props<I>) => {
  const listRef = React.useRef<LegendListRef>(null)
  const {selectedIndex} = props

  const lastIndexRef = React.useRef(selectedIndex)
  React.useEffect(() => {
    if (!isMobile && lastIndexRef.current !== selectedIndex) {
      void listRef.current?.scrollToIndex({index: selectedIndex})
    }
    lastIndexRef.current = selectedIndex
  }, [selectedIndex, listRef])

  if (
    !props.items.length &&
    (!props.suggestBotCommandsUpdateStatus ||
      props.suggestBotCommandsUpdateStatus === T.RPCChat.UIBotCommandsUpdateStatusTyp.blank)
  ) {
    return null
  }

  if (!isMobile) {
    const itemRenderer = (index: number) => {
      const i = props.items[index]
      return i ? (props.renderItem(index, i) as React.JSX.Element) : <></>
    }
    const itemHeight = {type: 'trueVariable' as const}
    const {rowHeight} = props
    const maxRows = Math.max(1, Math.floor(maxHeight / rowHeight))
    const listHeight = Math.min(props.items.length, maxRows) * rowHeight

    return (
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([desktopStyles.listContainer, props.style])}
        testID={TestIDs.CHAT_SUGGESTION_LIST}
      >
        <Kb.Box2 direction="vertical" fullWidth={true} style={{height: listHeight}}>
          <Kb.List
            ref={listRef}
            renderItem={itemRenderer}
            items={props.items}
            itemHeight={itemHeight}
            estimatedItemHeight={rowHeight}
            extraData={selectedIndex}
          />
        </Kb.Box2>
        {props.suggestBotCommandsUpdateStatus &&
        props.suggestBotCommandsUpdateStatus !== T.RPCChat.UIBotCommandsUpdateStatusTyp.blank ? (
          <Kb.Box2
            style={desktopStyles.commandStatusContainer}
            fullWidth={true}
            direction="vertical"
            justifyContent="center"
          >
            <BotCommandUpdateStatus status={props.suggestBotCommandsUpdateStatus} />
          </Kb.Box2>
        ) : null}
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      style={Kb.Styles.collapseStyles([nativeStyles.listContainer, props.style])}
      testID={TestIDs.CHAT_SUGGESTION_LIST}
    >
      <FlatList
        alwaysBounceVertical={false}
        renderItem={({index, item}) => props.renderItem(index, item)}
        style={nativeStyles.noGrow}
        data={props.items}
        keyExtractor={props.keyExtractor || (item => String(item))}
        keyboardShouldPersistTaps="always"
        windowSize={10}
        onScrollToIndexFailed={noop}
      />
      {props.suggestBotCommandsUpdateStatus &&
      props.suggestBotCommandsUpdateStatus !== T.RPCChat.UIBotCommandsUpdateStatusTyp.blank ? (
        <Kb.Box2
          style={nativeStyles.commandStatusContainer}
          fullWidth={true}
          direction="vertical"
          justifyContent="center"
        >
          <BotCommandUpdateStatus status={props.suggestBotCommandsUpdateStatus} />
        </Kb.Box2>
      ) : null}
    </Kb.Box2>
  )
}

const desktopStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      commandStatusContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
        ...Kb.Styles.padding(Kb.Styles.globalMargins.xxtiny, 0),
      },
      listContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
        borderRadius: Kb.Styles.borderRadius,
      },
    }) as const
)

const nativeStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      commandStatusContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
        ...Kb.Styles.padding(Kb.Styles.globalMargins.xtiny, 0),
      },
      listContainer: {flexGrow: 0, marginTop: 'auto'},
      noGrow: {flexGrow: 0},
    }) as const
)

export default SuggestionList
