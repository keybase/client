// @flow
import Input from './input/container'
import List from './list/container'
import HeaderOrSearchHeader from './header-or-search-header'
import SearchResultsList from '../../searchv3/results-list'
import OldProfileResetNotice from './notices/old-profile-reset-notice/container'
import React from 'react'
import Banner from './banner/container'
import {withPropsOnChange, compose, branch} from 'recompose'
import {Box, LoadingLine, ProgressIndicator, Text, HeaderHoc} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import ConversationError from './error/conversation-error'

import type {Props} from './index'

const Conversation = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
    {props.threadLoadedOffline &&
      <Box
        style={{
          ...globalStyles.flexBoxCenter,
          backgroundColor: globalColors.grey,
          flex: 1,
          maxHeight: 48,
          paddingBottom: globalMargins.tiny,
          paddingLeft: globalMargins.medium,
          paddingRight: globalMargins.medium,
          paddingTop: globalMargins.tiny,
        }}
      >
        <Text style={{textAlign: 'center', color: globalColors.black_40}} type="BodySemibold">
          Couldn't load all chat messages due to network connectivity. Retrying...
        </Text>
      </Box>}
    <HeaderOrSearchHeader
      inSearch={props.inSearch}
      onToggleInfoPanel={props.onOpenInfoPanelMobile}
      infoPanelOpen={false} // unused on mobile
      onBack={props.onBack}
      onChangeSearchText={props.onChangeSearchText}
      searchText={props.searchText}
      selectedSearchId={props.selectedSearchId}
      selectedConversationIDKey={props.selectedConversationIDKey}
      onUpdateSelectedSearchResult={props.onUpdateSelectedSearchResult}
      onAddNewParticipant={props.onAddNewParticipant}
      addNewParticipant={props.addNewParticipant}
    />
    {props.showSearchPending
      ? <ProgressIndicator style={{width: globalMargins.xlarge}} />
      : props.showSearchResults
          ? <SearchResultsList
              items={props.searchResultIds}
              onClick={props.onClickSearchResult}
              onShowTracker={props.onShowTrackerInSearch}
              selectedId={props.selectedSearchId}
              showSearchSuggestions={props.showSearchSuggestions}
              style={{flex: 1}}
            />
          : props.conversationIsError
              ? <ConversationError conversationErrorText={props.conversationErrorText} />
              : <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
                  <List
                    focusInputCounter={props.focusInputCounter}
                    listScrollDownCounter={props.listScrollDownCounter}
                    onEditLastMessage={props.onEditLastMessage}
                    onScrollDown={props.onScrollDown}
                    onFocusInput={props.onFocusInput}
                    editLastMessageCounter={props.editLastMessageCounter}
                  />
                  <Banner />
                  {props.showLoader && <LoadingLine />}
                  {props.finalizeInfo
                    ? <OldProfileResetNotice />
                    : <Input
                        focusInputCounter={props.focusInputCounter}
                        onEditLastMessage={props.onEditLastMessage}
                        onScrollDown={props.onScrollDown}
                      />}
                </Box>}
  </Box>
)

export default branch(
  ({inSearch}) => inSearch,
  compose(
    withPropsOnChange(['onExitSearch'], props => ({
      onCancel: () => props.onExitSearch(),
      title: 'New Chat',
      onBack: null,
    })),
    HeaderHoc
  )
)(Conversation)
