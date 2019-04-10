// @flow
// Just for desktop, we show inbox and conversation side by side
import * as React from 'react'
import * as Kb from '../common-adapters'
import Inbox from './inbox/container'
import InboxSearch from './inbox-search/container'
import Conversation from './conversation/container'
import {type RouteProps} from '../route-tree/render-route'
import Header from './header.desktop'
import {namedConnect} from '../util/container'

type Props = RouteProps<{}, {smallTeamsExpanded: boolean}> & {children: React.Node}

type InboxSwitchProps = RouteProps<{}, {smallTeamsExpanded: boolean}> & {children: React.Node} & {|
  searchEnabled: boolean,
|}

const InboxSwitch = (props: InboxSwitchProps) => {
  return props.searchEnabled ? (
    <InboxSearch />
  ) : (
    <Inbox routeState={props.routeState} navigateAppend={props.navigateAppend} />
  )
}

const mapStateToProps = state => {
  return {
    searchEnabled: !!state.chat2.inboxSearch,
  }
}

const InboxSwitchConnected = namedConnect<{}, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  s => ({...s}),
  'InboxSwitchConnected'
)(InboxSwitch)

class InboxAndConversation extends React.PureComponent<Props> {
  static navigationOptions = {
    header: undefined,
    headerTitle: Header,
  }
  render() {
    return (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <InboxSwitchConnected />
        <Conversation />
      </Kb.Box2>
    )
  }
}

export default InboxAndConversation
