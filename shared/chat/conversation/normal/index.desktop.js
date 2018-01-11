// @flow
import * as React from 'react'
import Banner from '../banner/container'
import Header from '../header/container'
import SearchResultsList from '../../../search/results-list/container'
import InputArea from '../input-area/container'
import List from '../list/container'
// import OldProfileResetNotice from '../notices/old-profile-reset-notice/container'
import InfoPanel from '../info-panel/container'
import {Box, Icon, LoadingLine, ProgressIndicator, Text} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'
import {readImageFromClipboard} from '../../../util/clipboard.desktop'
import CreateTeamHeader from '../create-team-header/container'
import YouAreReset from '../you-are-reset'

import type {Props} from '.'

type State = {
  infoPanelOpen: boolean,
  showDropOverlay: boolean,
}

const DropOverlay = ({onDragLeave, onDrop}) => (
  <Box style={dropOverlayStyle} onDragLeave={onDragLeave} onDrop={onDrop}>
    <Icon type="icon-file-dropping-48" />
  </Box>
)

const Offline = () => (
  <Box
    style={{
      ...globalStyles.flexBoxCenter,
      backgroundColor: globalColors.black_10,
      flex: 1,
      maxHeight: globalMargins.medium,
    }}
  >
    <Text type="BodySmallSemibold">
      Couldn't load all chat messages due to network connectivity. Retrying...
    </Text>
  </Box>
)

const InfoPaneWrapper = ({onToggle}) => (
  <div
    style={{
      ...globalStyles.flexBoxColumn,
      bottom: 0,
      position: 'absolute',
      right: 0,
      top: 35,
      width: 320,
    }}
  >
    <InfoPanel onToggleInfoPanel={onToggle} />
  </div>
)

class Conversation extends React.PureComponent<Props, State> {
  state = {
    infoPanelOpen: false,
    showDropOverlay: false,
  }

  componentWillReceiveProps(nextProps: Props) {
    const convoChanged = this.props.conversationIDKey !== nextProps.conversationIDKey
    if (convoChanged) {
      this.setState({infoPanelOpen: false})
    }

    // const inSearchChanged = this.props.inSearch !== nextProps.inSearch
    // if ((convoChanged || inSearchChanged) && !nextProps.inSearch && !nextProps.inboxFilter) {
    // this.props.onFocusInput()
    // }
  }

  _onDrop = e => {
    // const fileList = e.dataTransfer.files
    // if (!this.props.conversationIDKey) throw new Error('No conversation')
    // const conversationIDKey = this.props.conversationIDKey
    // // FileList, not an array
    // const inputs = Array.prototype.map.call(fileList, file => ({
    // conversationIDKey,
    // filename: file.path,
    // title: file.name,
    // type: file.type,
    // }))
    // TODO
    // this.props.onAttach(inputs)
    // this.setState({showDropOverlay: false})
  }

  _onDragEnter = e => {
    // e.dataTransfer.effectAllowed = 'copy'
    // this.setState({showDropOverlay: true})
  }

  _onDragLeave = e => {
    // this.setState({showDropOverlay: false})
  }

  _onPaste = e => {
    // TODO: Should we read/save the clipboard data on the main thread?
    // readImageFromClipboard(e, () => {
    // this.setState({showDropOverlay: true})
    // }).then(clipboardData => {
    // this.setState({showDropOverlay: false})
    // if (!this.props.conversationIDKey) throw new Error('No conversation')
    // if (clipboardData) {
    // const {path, title} = clipboardData
    // // TODO
    // // this.props.onAttach([
    // // {
    // // conversationIDKey: this.props.conversationIDKey,
    // // filename: path,
    // // title,
    // // type: 'Image',
    // // },
    // // ])
    // }
    // })
  }

  _onToggleInfoPanel = () => {
    this.setState(prevState => ({infoPanelOpen: !prevState.infoPanelOpen}))
  }

  render() {
    // TODO
    const header = (
      /* this.props.inSearch ? (
    <SearchHeader
      onExitSearch={props.onExitSearch}
      selectedConversationIDKey={props.selectedConversationIDKey}
    />
  ) : */ <Header
        infoPanelOpen={this.state.infoPanelOpen}
        onToggleInfoPanel={this._onToggleInfoPanel}
      />
    )
    let list

    // if (this.props.showSearchPending) {
    // list = <ProgressIndicator style={styleSpinner} />
    // } else if (this.props.showSearchResults) {
    // list = (
    // <SearchResultsList
    // searchKey={'chatSearch'}
    // onShowTracker={this.props.onShowTracker}
    // style={{...globalStyles.scrollable, flexGrow: 1}}
    // />
    // )
    // } else if (this.props.youAreReset) {
    // list = <YouAreReset />
    // } else {
    list = (
      <div style={{...globalStyles.flexBoxColumn, flex: 1}}>
        {/* this.props.showTeamOffer && <CreateTeamHeader /> TODO */}
        <List
          focusInputCounter={this.props.focusInputCounter}
          listScrollDownCounter={this.props.listScrollDownCounter}
          onScrollDown={this.props.onScrollDown}
          onFocusInput={this.props.onFocusInput}
        />
        <Banner />
      </div>
    )
    // }

    // TODO
    // const input = this.props.finalizeInfo ? (
    // <OldProfileResetNotice />
    // ) : (
    // const input = (
    // <Input focusInputCounter={this.props.focusInputCounter} onScrollDown={this.props.onScrollDown} />
    // )

    return (
      <Box
        className="conversation"
        style={containerStyle}
        onDragEnter={this._onDragEnter}
        onPaste={this._onPaste}
      >
        {this.props.threadLoadedOffline && <Offline />}
        {header}
        {this.props.showLoader && <LoadingLine />}
        {list}
        <InputArea />
        {this.state.infoPanelOpen && <InfoPaneWrapper onToggle={this._onToggleInfoPanel} />}
        {this.state.showDropOverlay && <DropOverlay onDragLeave={this._onDragLeave} onDrop={this._onDrop} />}
      </Box>
    )
  }
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  position: 'relative',
}

const dropOverlayStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.blue_60,
  bottom: 0,
  flex: 1,
  justifyContent: 'center',
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
}

const styleSpinner = {
  alignSelf: 'center',
  marginTop: globalMargins.small,
  width: 24,
}

export default Conversation
