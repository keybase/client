// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import {memoize} from '../../util/memoize'
import * as Shared from './shared'
import * as Flow from '../../util/flow'

class ConversationList extends React.PureComponent<Shared.Props> {
  _renderItem = ({item, index}) => {
    switch (item.type) {
      case 'small-team':
        return <Shared.SmallTeamRow {...item} />
      case 'group':
        return <Shared.SmallTeamRow {...item} />
      case 'more':
        return <Shared.Divider toggle={this.props.toggleExpand} hiddenCount={this.props.hiddenCount} />

      case 'big-team':
        return <Shared.BigTeamRow {...item} />
      case 'channel':
        return <Shared.ChannelRow {...item} />
      default:
        Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(item.type)
        return null
    }
  }
  _keyExtractor = (item, index) => index.toString()

  _memoizedOffsetGetter = memoize((data, index) => {
    if (index === 0) {
      return 0
    }
    if (!index) {
      return 0
    }
    // $FlowIssue can't figure out type for data.
    return this._memoizedOffsetGetter((data, index - 1)) + Shared.heights[data[index].type]
  })
  _getItemLayout = (data, index) => {
    return {
      index,
      length: Shared.heights[data[index].type],
      offset: this._memoizedOffsetGetter(data, index),
    }
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.NativeFlatList
          data={this.props.rows}
          keyExtractor={this._keyExtractor}
          renderItem={this._renderItem}
          windowSize={5}
          keyboardShouldPersistTaps="handled"
          getItemLayout={this._getItemLayout}
          removeClippedSubviews={true}
        />
      </Kb.Box2>
    )
  }
}

export default ConversationList
