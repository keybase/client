import * as Kb from '../../../../common-adapters'
import * as T from '../../../../constants/types'
import * as Styles from '../../../../styles'
import noop from 'lodash/noop'
import type {Props} from './suggestion-list'
import {BotCommandUpdateStatus} from '../normal/shared'
import {FlatList} from 'react-native'

const SuggestionList = (props: Props) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    style={Styles.collapseStyles([styles.listContainer, props.style])}
  >
    <FlatList
      alwaysBounceVertical={false}
      renderItem={({index, item}) => props.renderItem(index, item)}
      style={styles.noGrow}
      data={props.items}
      keyExtractor={props.keyExtractor || (item => item)}
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      commandStatusContainer: {
        backgroundColor: Styles.globalColors.white,
        justifyContent: 'center',
        ...Styles.padding(Styles.globalMargins.xtiny, 0),
      },
      listContainer: {flexGrow: 0, marginTop: 'auto'},
      noGrow: {flexGrow: 0},
    }) as const
)

export default SuggestionList
