// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import {connect, type TypedState} from '../../../util/container'
import ConversationHeader from './normal/container'
import Search from './search'
import CreateTeamHeader from '../create-team-header/container'

type Props = {
  conversationIDKey: Types.ConversationIDKey,
  onToggleInfoPanel: () => void,
  isSearching: boolean,
  infoPanelOpen: boolean,
}

class HeaderArea extends React.PureComponent<Props> {
  render() {
    return this.props.isSearching ? (
      <React.Fragment>
        <Search />
        {this.props.showTeamOffer && <CreateTeamHeader conversationIDKey={this.props.conversationIDKey} />}
      </React.Fragment>
    ) : (
      <ConversationHeader
        infoPanelOpen={this.props.infoPanelOpen}
        onToggleInfoPanel={this.props.onToggleInfoPanel}
        conversationIDKey={this.props.conversationIDKey}
      />
    )
  }
}

const mapStateToProps = (state: TypedState): * => {
  const isSearching = state.chat2.pendingMode === 'searchingForUsers' && state.chat2.pendingSelected
  return {
    isSearching,
    showTeamOffer: isSearching && state.chat2.pendingConversationUsers.size > 1,
  }
}
export default connect(mapStateToProps)(HeaderArea)
