// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import {connect, type TypedState} from '../../../util/container'
import Normal from './normal/container'
import Search from './search'

type Props = {
  conversationIDKey: Types.ConversationIDKey,
  onToggleInfoPanel: () => void,
  isSearching: boolean,
  infoPanelOpen: boolean,
}

class HeaderArea extends React.PureComponent<Props> {
  render() {
    return this.props.isSearching ? (
      <Search />
    ) : (
      <Normal
        infoPanelOpen={this.props.infoPanelOpen}
        onToggleInfoPanel={this.props.onToggleInfoPanel}
        conversationIDKey={this.props.conversationIDKey}
      />
    )
  }
}

const mapStateToProps = (state: TypedState): * => ({
  isSearching: state.chat2.pendingMode === 'searchingForUsers' && state.chat2.pendingSelected,
})

export default connect(mapStateToProps)(HeaderArea)
