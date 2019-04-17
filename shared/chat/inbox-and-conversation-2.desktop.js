// @flow
// Just for desktop, we show inbox and conversation side by side
import * as React from 'react'
import * as Kb from '../common-adapters'
import Inbox from './inbox/container'
import InboxSearch from './inbox-search/container'
import Conversation from './conversation/container'
import Header from './header.desktop'
import {namedConnect} from '../util/container'

type Props = {||}

type InboxSwitchProps = Props & {|
  searchEnabled: boolean,
|}

const InboxSwitch = (props: InboxSwitchProps) => {
  return props.searchEnabled ? <InboxSearch /> : <Inbox />
}

const mapStateToProps = state => {
  return {
    searchEnabled: !!state.chat2.inboxSearch,
  }
}

const InboxSwitchConnected = namedConnect<Props, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  (s, d, o) => ({...o, ...s}),
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
