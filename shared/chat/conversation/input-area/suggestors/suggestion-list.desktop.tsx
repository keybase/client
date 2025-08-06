import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type {Props} from './suggestion-list'
import SafeReactList from '@/common-adapters/safe-react-list'
import type RL from 'react-list'
import {BotCommandUpdateStatus} from './shared'

const SuggestionList = <I,>(props: Props<I>) => {
  const listRef = React.useRef<RL>(null)
  const {selectedIndex} = props

  const lastIndexRef = React.useRef(selectedIndex)
  React.useEffect(() => {
    if (lastIndexRef.current !== selectedIndex) {
      if (listRef.current) {
        listRef.current.scrollAround(selectedIndex)
      }
    }
    lastIndexRef.current = selectedIndex
  }, [selectedIndex])

  const itemRenderer = (index: number) => {
    const i = props.items[index]
    return i ? (props.renderItem(index, i) as React.JSX.Element) : <></>
  }

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
      <Kb.ScrollView style={styles.fullHeight}>
        <SafeReactList ref={listRef} itemRenderer={itemRenderer} length={props.items.length} type="uniform" />
      </Kb.ScrollView>
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
      listContainer: {backgroundColor: Kb.Styles.globalColors.white, borderRadius: 4, maxHeight: 224},
    }) as const
)

export default SuggestionList
