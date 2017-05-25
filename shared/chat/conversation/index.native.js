// @flow
import Header from './header/container'
import Input from './input/container'
import List from './list/container'
import OldProfileResetNotice from './notices/old-profile-reset-notice/container'
import React from 'react'
import SidePanel from './side-panel/container'
import Banner from './banner/container'
import {Box, LoadingLine, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'

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
    <Header
      sidePanelOpen={props.sidePanelOpen}
      onToggleSidePanel={props.onToggleSidePanel}
      onBack={props.onBack}
    />
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

    {props.sidePanelOpen && <SidePanel onToggleSidePanel={props.onToggleSidePanel} />}
  </Box>
)

export default Conversation
