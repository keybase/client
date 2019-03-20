// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as SearchConstants from '../../../constants/search'
import {connect} from '../../../util/container'
import ConversationHeader from './normal/container'
import Search from './search'
import CreateTeamHeader from '../create-team-header/container'
import flags from '../../../util/feature-flags'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  isPending: boolean,
  onToggleInfoPanel: () => void,
|}

type Props = {|
  ...OwnProps,
  infoPanelOpen: boolean,
  isSearching: boolean,
  showTeamOffer: boolean,
|}

class HeaderArea extends React.PureComponent<Props> {
  render() {
    // TODO handle this in new router
    return this.props.isSearching ? (
      <React.Fragment>
        <Search />
        {this.props.showTeamOffer && <CreateTeamHeader conversationIDKey={this.props.conversationIDKey} />}
      </React.Fragment>
    ) : (
      <ConversationHeader
        isPending={this.props.isPending}
        infoPanelOpen={this.props.infoPanelOpen}
        onToggleInfoPanel={this.props.onToggleInfoPanel}
        conversationIDKey={this.props.conversationIDKey}
      />
    )
  }
}

const mapStateToProps = (state, {conversationIDKey, isPending}: OwnProps) => {
  const isSearching = state.chat2.pendingMode === 'searchingForUsers' && isPending
  const inputResults = SearchConstants.getUserInputItemIds(state, 'chatSearch')
  // for now this is just the info button always in the new routing scheme
  const infoPanelOpen = flags.useNewRouter ? false : Constants.isInfoPanelOpen(state)
  return {
    infoPanelOpen,
    isPending,
    isSearching,
    showTeamOffer: isSearching && inputResults.size > 1,
  }
}

const Connected = connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  (s, d, o) => ({...o, ...s, ...d})
)(HeaderArea)

const Empty = () => null
export default (flags.useNewRouter ? Empty : Connected)
