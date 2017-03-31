// @flow
import Header from './header.native'
import Input from './input.native'
import List from './list.native'
import OldProfileResetNotice from './notices/old-profile-reset-notice'
import ParticipantRekey from './participant-rekey'
import React from 'react'
import SidePanel from './side-panel'
import YouRekey from './you-rekey'
import hoc from './index-hoc'
import Banner from './banner'
import {Box} from '../../common-adapters'
import {compose, branch, renderComponent} from 'recompose'
import {globalStyles} from '../../styles'

import type {Props} from './index'

const Conversation = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
    <Header {...props.headerProps} />
    <List {...props.listProps} />
    {props.bannerMessage && <Banner message={props.bannerMessage} />}
    {props.finalizeInfo
      ? <OldProfileResetNotice
        onOpenNewerConversation={props.onOpenNewerConversation}
        username={props.finalizeInfo.resetUser} />
      : <Input {...props.inputProps} /> }
    {props.sidePanelOpen && <SidePanel
      you={props.you}
      metaDataMap={props.metaDataMap}
      followingMap={props.followingMap}
      muted={props.muted}
      onAddParticipant={props.onAddParticipant}
      onMuteConversation={props.onMuteConversation}
      onShowBlockConversationDialog={props.onShowBlockConversationDialog}
      onShowProfile={props.onShowProfile}
      onToggleSidePanel={props.onToggleSidePanel}
      participants={props.participants} /> }
  </Box>
)

export default compose(
  branch(
    (props: Props) => props.rekeyInfo && props.rekeyInfo.get('rekeyParticipants').count(),
    renderComponent(ParticipantRekey)
  ),
  branch(
    (props: Props) => !!props.rekeyInfo && !props.finalizeInfo,
    renderComponent(YouRekey)
  ),
  hoc
)(Conversation)
