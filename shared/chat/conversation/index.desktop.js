// @flow
import Banner from './banner/container'
import HeaderOrSearchHeader from './header-or-search-header'
import SearchResultsList from '../../searchv3/results-list'
import Input from './input/container'
import List from './list/container'
import OldProfileResetNotice from './notices/old-profile-reset-notice/container'
import React, {Component} from 'react'
import InfoPanel from './info-panel/container'
import {Box, Icon, LoadingLine, ProgressIndicator, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {readImageFromClipboard} from '../../util/clipboard.desktop'

import type {Props} from '.'

type State = {
  showDropOverlay: boolean,
  infoPanelOpen: boolean,
}

class Conversation extends Component<void, Props, State> {
  state = {
    showDropOverlay: false,
    infoPanelOpen: false,
  }

  componentWillReceiveProps(nextProps: Props) {
    const convoChanged = this.props.selectedConversationIDKey !== nextProps.selectedConversationIDKey
    if (convoChanged) {
      this.setState({infoPanelOpen: false})
    }

    const inSearchChanged = this.props.inSearch !== nextProps.inSearch
    if ((convoChanged || inSearchChanged) && !nextProps.inSearch) {
      this.props.onFocusInput()
    }
  }

  _onDrop = e => {
    const fileList = e.dataTransfer.files
    if (!this.props.selectedConversationIDKey) throw new Error('No conversation')
    const conversationIDKey = this.props.selectedConversationIDKey
    // FileList, not an array
    const inputs = Array.prototype.map.call(fileList, file => ({
      conversationIDKey,
      filename: file.path,
      title: file.name,
      type: file.type,
    }))
    this.props.onAttach(inputs)
    this.setState({showDropOverlay: false})
  }

  _onDragEnter = e => {
    e.dataTransfer.effectAllowed = 'copy'
    this.setState({showDropOverlay: true})
  }

  _onDragLeave = e => {
    this.setState({showDropOverlay: false})
  }

  _onPaste = e => {
    // TODO: Should we read/save the clipboard data on the main thread?
    readImageFromClipboard(e, () => {
      this.setState({showDropOverlay: true})
    }).then(clipboardData => {
      this.setState({showDropOverlay: false})
      if (!this.props.selectedConversationIDKey) throw new Error('No conversation')
      if (clipboardData) {
        const {path, title} = clipboardData
        this.props.onAttach([
          {
            conversationIDKey: this.props.selectedConversationIDKey,
            filename: path,
            title,
            type: 'Image',
          },
        ])
      }
    })
  }

  _onToggleInfoPanel = () => {
    this.setState({infoPanelOpen: !this.state.infoPanelOpen})
  }

  render() {
    const dropOverlay =
      this.state.showDropOverlay &&
      <Box style={dropOverlayStyle} onDragLeave={this._onDragLeave} onDrop={this._onDrop}>
        <Icon type="icon-file-dropping-48" />
      </Box>

    const offline =
      this.props.threadLoadedOffline &&
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

    return (
      <Box
        className="conversation"
        style={containerStyle}
        onDragEnter={this._onDragEnter}
        onPaste={this._onPaste}
      >
        {offline}
        <HeaderOrSearchHeader
          inSearch={this.props.inSearch}
          infoPanelOpen={this.state.infoPanelOpen}
          onToggleInfoPanel={this._onToggleInfoPanel}
          onBack={this.props.onBack}
          onChangeSearchText={this.props.onChangeSearchText}
          searchText={this.props.searchText}
          selectedConversationIDKey={this.props.selectedConversationIDKey}
          selectedSearchId={this.props.selectedSearchId}
          onUpdateSelectedSearchResult={this.props.onUpdateSelectedSearchResult}
          onAddNewParticipant={this.props.onAddNewParticipant}
          addNewParticipant={this.props.addNewParticipant}
        />
        {this.props.showSearchPending
          ? <ProgressIndicator style={{width: globalMargins.xlarge}} />
          : this.props.showSearchResults
              ? <SearchResultsList
                  items={this.props.searchResultIds}
                  onClick={this.props.onClickSearchResult}
                  onShowTracker={this.props.onShowTrackerInSearch}
                  selectedId={this.props.selectedSearchId}
                  showSearchSuggestions={this.props.showSearchSuggestions}
                  style={{...globalStyles.scrollable, flexGrow: 1}}
                />
              : <div style={{...globalStyles.flexBoxColumn, flex: 1}}>
                  <List
                    focusInputCounter={this.props.focusInputCounter}
                    listScrollDownCounter={this.props.listScrollDownCounter}
                    onEditLastMessage={this.props.onEditLastMessage}
                    onScrollDown={this.props.onScrollDown}
                    onFocusInput={this.props.onFocusInput}
                    editLastMessageCounter={this.props.editLastMessageCounter}
                  />
                  <Banner />
                  {this.props.showLoader && <LoadingLine />}
                  {this.props.finalizeInfo
                    ? <OldProfileResetNotice />
                    : <Input
                        focusInputCounter={this.props.focusInputCounter}
                        onEditLastMessage={this.props.onEditLastMessage}
                        onScrollDown={this.props.onScrollDown}
                      />}
                  {this.state.infoPanelOpen &&
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
                      <InfoPanel onToggleInfoPanel={this._onToggleInfoPanel} />
                    </div>}
                  {dropOverlay}
                </div>}
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
  backgroundColor: globalColors.blue5_60,
  bottom: 0,
  flex: 1,
  justifyContent: 'center',
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
}

export default Conversation
