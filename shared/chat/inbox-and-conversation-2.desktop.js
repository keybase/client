// @flow
// Just for desktop, we show inbox and conversation side by side
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import Inbox from './inbox/container'
import Conversation from './conversation/container'
import {type RouteProps} from '../route-tree/render-route'

type Props = RouteProps<{}, {smallTeamsExpanded: boolean}> & {children: React.Node}

class InboxAndConversation extends React.PureComponent<Props> {
  render() {
    return (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Inbox routeState={this.props.routeState} navigateAppend={this.props.navigateAppend} />
        <Conversation />
      </Kb.Box2>
    )
  }
}

export default InboxAndConversation
