import * as React from 'react'
import ReactList from 'react-list'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import {Props} from './suggestion-list'
import {BotCommandUpdateStatus} from '../normal/shared'

class SuggestionList extends React.Component<Props> {
  private listRef = React.createRef<ReactList>()

  componentDidMount() {
    // hack to get `ReactList` to render more than one item on initial mount
    this.forceUpdate()
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.selectedIndex !== this.props.selectedIndex && this.listRef.current) {
      this.listRef.current.scrollAround(this.props.selectedIndex)
    }
  }

  private itemRenderer = (index: number) =>
    this.props.renderItem(index, this.props.items[index]) as JSX.Element

  render() {
    return (
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={Styles.collapseStyles([styles.listContainer, this.props.style])}
      >
        <Kb.ScrollView style={styles.fullHeight}>
          <ReactList
            ref={this.listRef}
            itemRenderer={this.itemRenderer}
            length={this.props.items.length}
            type="uniform"
          />
        </Kb.ScrollView>
        {this.props.suggestBotCommandsUpdateStatus &&
          this.props.suggestBotCommandsUpdateStatus !== RPCChatTypes.UIBotCommandsUpdateStatusTyp.blank && (
            <Kb.Box2 style={styles.commandStatusContainer} fullWidth={true} direction="vertical">
              <BotCommandUpdateStatus status={this.props.suggestBotCommandsUpdateStatus} />
            </Kb.Box2>
          )}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      commandStatusContainer: {
        backgroundColor: Styles.globalColors.white,
        justifyContent: 'center',
        ...Styles.padding(Styles.globalMargins.xxtiny, 0),
      },
      fullHeight: {height: '100%'},
      listContainer: {backgroundColor: Styles.globalColors.white, borderRadius: 4, maxHeight: 224},
    } as const)
)

export default SuggestionList
