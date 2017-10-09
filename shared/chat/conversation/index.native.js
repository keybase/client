// @flow
import Input from './input/container'
import List from './list/container'
import HeaderOrSearchHeader from './header-or-search-header'
import SearchResultsList from '../../search/results-list/container'
import OldProfileResetNotice from './notices/old-profile-reset-notice/container'
import * as React from 'react'
import Banner from './banner/container'
import {withPropsOnChange, compose, branch} from 'recompose'
import {Box, LoadingLine, Text, HeaderHoc} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import CreateTeamHeader from './create-team-header/container'

import type {Props} from './index'

const Conversation = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, ...globalStyles.fullHeight}}>
    {props.threadLoadedOffline &&
      <Box
        style={{
          ...globalStyles.flexBoxCenter,
          backgroundColor: globalColors.grey,
          width: '100%',
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
      onExitSearch={props.onExitSearch}
      selectedConversationIDKey={props.selectedConversationIDKey}
    />
    {props.showSearchResults
      ? <SearchResultsList searchKey={'chatSearch'} onShowTracker={props.onShowTrackerInSearch} />
      : <Box
          style={{
            ...globalStyles.flexBoxColumn,
            ...globalStyles.flexGrow,
            position: 'relative',
          }}
        >
          <Box style={globalStyles.flexGrow}>
            <List
              focusInputCounter={props.focusInputCounter}
              listScrollDownCounter={props.listScrollDownCounter}
              onEditLastMessage={props.onEditLastMessage}
              onScrollDown={props.onScrollDown}
              onFocusInput={props.onFocusInput}
              editLastMessageCounter={props.editLastMessageCounter}
            />
            {props.showTeamOffer && <CreateTeamHeader />}
          </Box>
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
