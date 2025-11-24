import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type {Props} from './suggestion-list'
import {BotCommandUpdateStatus} from './shared'
import {useListRef, useDynamicRowHeight} from 'react-window'

const SuggestionList = <I,>(props: Props<I>) => {
  const listRef = useListRef(undefined)
  const {selectedIndex} = props

  const lastIndexRef = React.useRef(selectedIndex)
  React.useEffect(() => {
    if (lastIndexRef.current !== selectedIndex) {
      listRef.current?.scrollToRow({index: selectedIndex})
    }
    lastIndexRef.current = selectedIndex
  }, [selectedIndex, listRef])

  const itemRenderer = (index: number) => {
    const i = props.items[index]
    return i ? (props.renderItem(index, i) as React.JSX.Element) : <></>
  }

  const rowHeight = useDynamicRowHeight({defaultRowHeight: 24})
  const itemHeight = React.useMemo(() => {
    return {rowHeight, type: 'trueVariable' as const}
  }, [rowHeight])

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
      <Kb.List2 desktopRef={listRef} renderItem={itemRenderer} items={props.items} itemHeight={itemHeight} />
      {props.suggestBotCommandsUpdateStatus &&
      props.suggestBotCommandsUpdateStatus !== T.RPCChat.UIBotCommandsUpdateStatusTyp.blank ? (
        <Kb.Box2 style={styles.commandStatusContainer} fullWidth={true} direction="vertical">
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
        justifyContent: 'center',
        ...Kb.Styles.padding(Kb.Styles.globalMargins.xxtiny, 0),
      },
      fullHeight: {height: '100%'},
      listContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
        borderRadius: 4,
        maxHeight: 224,
      },
    }) as const
)

export default SuggestionList
