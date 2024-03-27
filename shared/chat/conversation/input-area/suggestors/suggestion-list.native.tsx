import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import noop from 'lodash/noop'
import type {Props} from './suggestion-list'
import {BotCommandUpdateStatus} from '../normal/shared'
import {FlatList} from 'react-native'

function SuggestionList<I>(props: Props<I>) {
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
      <FlatList
        alwaysBounceVertical={false}
        renderItem={({index, item}) => props.renderItem(index, item)}
        style={styles.noGrow}
        data={props.items}
        keyExtractor={props.keyExtractor || (item => String(item))}
        keyboardShouldPersistTaps="always"
        windowSize={10}
        onScrollToIndexFailed={noop}
      />
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
        ...Kb.Styles.padding(Kb.Styles.globalMargins.xtiny, 0),
      },
      listContainer: {flexGrow: 0, marginTop: 'auto'},
      noGrow: {flexGrow: 0},
    }) as const
)

export default SuggestionList
