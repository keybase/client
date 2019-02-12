// @flow
import * as React from 'react'
import Banner from '../bottom-banner/container'
import HeaderArea from '../header-area/container'
import InputArea from '../input-area/container'
import ListArea from '../list-area/container'
import {Box, LoadingLine, Text, HeaderHocHeader} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'
import type {Props} from './index.types'

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
    <Text center={true} type="BodySmallSemibold">
      Couldn't load all chat messages due to network connectivity. Retrying...
    </Text>
  </Box>
)

class Conversation extends React.PureComponent<Props> {
  render() {
    return (
      <Box style={containerStyle}>
        {this.props.isSearching && (
          <HeaderHocHeader
            title="New chat"
            leftAction="cancel"
            onLeftAction={this.props.onCancelSearch}
            headerStyle={_headerStyle}
          />
        )}
        {this.props.threadLoadedOffline && <Offline />}
        <HeaderArea
          isPending={this.props.isPending}
          infoPanelOpen={false}
          onToggleInfoPanel={this.props.onToggleInfoPanel}
          conversationIDKey={this.props.conversationIDKey}
        />
        {this.props.showLoader && <LoadingLine />}
        <ListArea
          isPending={this.props.isPending}
          scrollListDownCounter={this.props.scrollListDownCounter}
          scrollListUpCounter={this.props.scrollListUpCounter}
          onFocusInput={this.props.onFocusInput}
          conversationIDKey={this.props.conversationIDKey}
        />
        <Banner conversationIDKey={this.props.conversationIDKey} />
        <InputArea
          isPending={this.props.isPending}
          focusInputCounter={this.props.focusInputCounter}
          onRequestScrollDown={this.props.onRequestScrollDown}
          onRequestScrollUp={this.props.onRequestScrollUp}
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

const _headerStyle = {
  borderBottomWidth: 0,
}

export default Conversation
