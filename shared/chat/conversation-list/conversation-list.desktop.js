// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import AutoSizer from 'react-virtualized-auto-sizer'
import {VariableSizeList} from 'react-window'
import * as Shared from './shared'
import * as Flow from '../../util/flow'
import {virtualListMarks} from '../../local-debug'

class ConversationList extends React.PureComponent<Shared.Props> {
  _item = index => {
    const row = this.props.rows[index]
    switch (row.type) {
      case 'small-team':
        return <Shared.SmallTeamRow key={index.toString()} {...row} />
      case 'group':
        return <Shared.SmallTeamRow key={index.toString()} {...row} />
      case 'more':
        return (
          <Shared.Divider
            key={index.toString()}
            toggle={this.props.toggleExpand}
            hiddenCount={this.props.hiddenCount}
          />
        )

      case 'big-team':
        return <Shared.BigTeamRow key={index.toString()} {...row} />
      case 'channel':
        return <Shared.ChannelRow key={index.toString()} {...row} />
      default:
        Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(row.type)
        return null
    }
  }
  _itemRenderer = (index, style) => {
    const divStyle = virtualListMarks ? {...style, backgroundColor: 'purple', overflow: 'hidden'} : style
    return <div style={divStyle}>{this._item(index)}</div>
  }
  _onItemsRendered = () => {}
  _itemSizeGetter = index => {
    const height = Shared.heights[this.props.rows[index].type]
    return height || 0
  }
  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <AutoSizer>
          {({height, width}) => (
            <VariableSizeList
              height={height}
              width={width}
              onItemsRendered={this._onItemsRendered}
              itemCount={this.props.rows.length}
              itemSize={this._itemSizeGetter}
              estimatedItemSize={Shared.heights.estimate}
            >
              {({index, style}) => this._itemRenderer(index, style)}
            </VariableSizeList>
          )}
        </AutoSizer>
      </Kb.Box2>
    )
  }
}

export default ConversationList
