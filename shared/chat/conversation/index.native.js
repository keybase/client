// @flow
import Header from './header/container'
import Input from './input/container'
import List from './list/container'
import OldProfileResetNotice from './notices/old-profile-reset-notice'
import ParticipantRekey from './participant-rekey'
import React from 'react'
import SidePanel from './side-panel/container'
import YouRekey from './you-rekey'
import Banner from './banner/container'
import {Box, LoadingLine} from '../../common-adapters'
import {compose, branch, renderComponent} from 'recompose'
import {globalStyles} from '../../styles'

import type {Props} from './index'

const Conversation = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
    <Header sidePanelOpen={props.sidePanelOpen} onToggleSidePanel={props.onToggleSidePanel} onBack={props.onBack} />
    <List
      selectedConversationIDKey={props.selectedConversationIDKey}
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
      ? <OldProfileResetNotice
        onOpenNewerConversation={props.onOpenNewerConversation}
        username={props.finalizeInfo.resetUser} />
      : <Input
        focusInputCounter={props.focusInputCounter}
        onEditLastMessage={props.onEditLastMessage}
        onScrollDown={props.onScrollDown}
      /> }

    {props.sidePanelOpen && <SidePanel onToggleSidePanel={props.onToggleSidePanel} />}
  </Box>
)

export default compose(
  branch(
    (props: Props) => props.rekeyInfo && props.rekeyInfo.get('rekeyParticipants').count(),
    renderComponent(ParticipantRekey)),
  branch(
    (props: Props) => !!props.rekeyInfo && !props.finalizeInfo,
    renderComponent(YouRekey)),
)(Conversation)
