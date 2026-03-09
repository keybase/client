import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type {Props} from './suggestion-list'
import {BotCommandUpdateStatus} from './shared'
import type {LegendListRef} from '@/common-adapters'

const SuggestionList = <I,>(props: Props<I>) => {
  const listRef = React.useRef<LegendListRef>(null)
  const {selectedIndex} = props

  const lastIndexRef = React.useRef(selectedIndex)
  React.useEffect(() => {
    if (lastIndexRef.current !== selectedIndex) {
      void listRef.current?.scrollToIndex({index: selectedIndex})
    }
    lastIndexRef.current = selectedIndex
  }, [selectedIndex, listRef])

  const itemRenderer = (index: number) => {
    const i = props.items[index]
    return i ? (props.renderItem(index, i) as React.JSX.Element) : <></>
  }

  const itemHeight = {type: 'trueVariable' as const}

  if (
    !props.items.length &&
    (!props.suggestBotCommandsUpdateStatus ||
      props.suggestBotCommandsUpdateStatus === T.RPCChat.UIBotCommandsUpdateStatusTyp.blank)
  ) {
    return null
  }

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      style={Kb.Styles.collapseStyles([styles.listContainer, props.style])}
    >
      <Kb.List ref={listRef} renderItem={itemRenderer} items={props.items} itemHeight={itemHeight} estimatedItemHeight={24} extraData={selectedIndex} />
      {props.suggestBotCommandsUpdateStatus &&
      props.suggestBotCommandsUpdateStatus !== T.RPCChat.UIBotCommandsUpdateStatusTyp.blank ? (
        <Kb.Box2 style={styles.commandStatusContainer} fullWidth={true} direction="vertical" justifyContent="center">
          <BotCommandUpdateStatus status={props.suggestBotCommandsUpdateStatus} />
        </Kb.Box2>
      ) : null}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      commandStatusContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
        ...Kb.Styles.padding(Kb.Styles.globalMargins.xxtiny, 0),
      },
      listContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
        borderRadius: 4,
        maxHeight: 224,
      },
    }) as const
)

export default SuggestionList
