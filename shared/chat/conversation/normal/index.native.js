// @flow
import * as React from 'react'
import Banner from '../bottom-banner/container'
import HeaderArea from '../header-area/container'
import InputArea from '../input-area/container'
import ListArea from '../list-area/container'
import {Box, LoadingLine, Text} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'

type Props = {
  conversationIDKey: Types.ConversationIDKey,
  focusInputCounter: number,
  infoPanelOpen: boolean,
  listScrollDownCounter: number,
  showLoader: boolean,
  onAttach: (paths: Array<string>) => void,
  onFocusInput: () => void,
  onScrollDown: () => void,
  onShowTracker: (username: string) => void,
  onToggleInfoPanel: () => void,
  threadLoadedOffline: boolean,
}

const Offline = () => (
  <Box
    style={{
      ...globalStyles.flexBoxCenter,
      backgroundColor: globalColors.grey,
      paddingBottom: globalMargins.tiny,
      paddingLeft: globalMargins.medium,
      paddingRight: globalMargins.medium,
      paddingTop: globalMargins.tiny,
      width: '100%',
    }}
  >
    <Text style={{color: globalColors.black_40, textAlign: 'center'}} type="BodySemibold">
      Couldn't load all chat messages due to network connectivity. Retrying...
    </Text>
  </Box>
)

class Conversation extends React.PureComponent<Props> {
  render() {
    return (
      <Box style={containerStyle}>
        {this.props.threadLoadedOffline && <Offline />}
        <HeaderArea
          onToggleInfoPanel={this.props.onToggleInfoPanel}
          infoPanelOpen={false}
          conversationIDKey={this.props.conversationIDKey}
        />
        {this.props.showLoader && <LoadingLine />}
        <ListArea
          onToggleInfoPanel={this.props.onToggleInfoPanel}
          listScrollDownCounter={this.props.listScrollDownCounter}
          onFocusInput={this.props.onFocusInput}
          conversationIDKey={this.props.conversationIDKey}
        />
        <Banner conversationIDKey={this.props.conversationIDKey} />
        <InputArea
          focusInputCounter={this.props.focusInputCounter}
          onScrollDown={this.props.onScrollDown}
          conversationIDKey={this.props.conversationIDKey}
        />
      </Box>
    )
  }
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.fullHeight,
}

export default Conversation
