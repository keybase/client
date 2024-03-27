import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type {Props} from './suggestion-list'
import SafeReactList from '@/common-adapters/safe-react-list'
import type RL from 'react-list'
import {BotCommandUpdateStatus} from '../normal/shared'

class SuggestionList<I> extends React.Component<Props<I>> {
  private listRef = React.createRef<RL>()

  componentDidMount() {
    // hack to get `ReactList` to render more than one item on initial mount
    this.forceUpdate()
  }

  componentDidUpdate(prevProps: Props<I>) {
    if (prevProps.selectedIndex !== this.props.selectedIndex && this.listRef.current) {
      this.listRef.current.scrollAround(this.props.selectedIndex)
    }
  }

  private itemRenderer = (index: number) => {
    const i = this.props.items[index]
    return i ? (this.props.renderItem(index, i) as React.JSX.Element) : <></>
  }

  render() {
    if (
      !this.props.items.length &&
      (!this.props.suggestBotCommandsUpdateStatus ||
        this.props.suggestBotCommandsUpdateStatus === T.RPCChat.UIBotCommandsUpdateStatusTyp.blank)
    ) {
      return null
    }
    return (
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([styles.listContainer, this.props.style])}
      >
        <Kb.ScrollView style={styles.fullHeight}>
          <SafeReactList
            ref={this.listRef}
            itemRenderer={this.itemRenderer}
            length={this.props.items.length}
            type="uniform"
          />
        </Kb.ScrollView>
        {this.props.suggestBotCommandsUpdateStatus &&
        this.props.suggestBotCommandsUpdateStatus !== T.RPCChat.UIBotCommandsUpdateStatusTyp.blank ? (
          <Kb.Box2 style={styles.commandStatusContainer} fullWidth={true} direction="vertical">
            <BotCommandUpdateStatus status={this.props.suggestBotCommandsUpdateStatus} />
          </Kb.Box2>
        ) : null}
      </Kb.Box2>
    )
  }
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
