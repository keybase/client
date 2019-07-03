import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import {connect} from '../../../util/container'
import {isMobile} from '../../../styles'
import ConversationHeader from './normal/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  onToggleInfoPanel: () => void
}

type Props = {
  infoPanelOpen: boolean
} & OwnProps

class HeaderArea extends React.PureComponent<Props> {
  render() {
    return (
      <ConversationHeader
        infoPanelOpen={this.props.infoPanelOpen}
        onToggleInfoPanel={this.props.onToggleInfoPanel}
        conversationIDKey={this.props.conversationIDKey}
      />
    )
  }
}

// for now this is just the info button always in the new routing scheme
const mapStateToProps = () => ({
  infoPanelOpen: Constants.isInfoPanelOpen(),
})

const Connected = connect(
  mapStateToProps,
  () => ({}),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(HeaderArea)

const Empty = () => null
export default (!isMobile ? Empty : Connected)
