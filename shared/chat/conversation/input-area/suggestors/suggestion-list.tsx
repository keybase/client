import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import noop from 'lodash/noop'
import type {Props} from './suggestion-list.shared'
import {BotCommandUpdateStatus} from './shared'
import type {LegendListRef} from '@/common-adapters'
import {FlatList} from 'react-native'

const SuggestionList = <I,>(props: Props<I>) => {
  const listRef = React.useRef<LegendListRef>(null)
  const {selectedIndex} = props

  const lastIndexRef = React.useRef(selectedIndex)
  React.useEffect(() => {
    if (!Kb.Styles.isMobile && lastIndexRef.current !== selectedIndex) {
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

  if (!Kb.Styles.isMobile) {
    const itemRenderer = (index: number) => {
      const i = props.items[index]
      return i ? (props.renderItem(index, i) as React.JSX.Element) : <></>
    }
    const itemHeight = {type: 'trueVariable' as const}
    const maxHeight = 224
    const estimatedItemHeight = 24
    const listHeight = Math.min(props.items.length * estimatedItemHeight, maxHeight)

    return (
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([desktopStyles.listContainer, {height: listHeight}, props.style])}
      >
        <Kb.List
          ref={listRef}
          renderItem={itemRenderer}
          items={props.items}
          itemHeight={itemHeight}
          estimatedItemHeight={estimatedItemHeight}
          extraData={selectedIndex}
        />
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
        borderRadius: 4,
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
