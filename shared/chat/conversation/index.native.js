// @flow
import Header from './header.native'
import Input from './input.native'
import List from './list.native'
import OldProfileResetNotice from './notices/old-profile-reset-notice'
import ParticipantRekey from './participant-rekey'
import React from 'react'
import YouRekey from './you-rekey'
import hoc from './index-hoc'
import {Box} from '../../common-adapters'
import {branch, renderComponent} from 'recompose'
import {globalStyles} from '../../styles'

import type {Props} from './index'

const Conversation = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
    <Header {...props.headerProps} />
    <List {...props.listProps} />
    {props.finalizeInfo
      ? <OldProfileResetNotice
        onOpenNewerConversation={props.onOpenNewerConversation}
        username={props.finalizeInfo.resetUser} />
      : <Input {...props.inputProps} /> }
  </Box>
)

export default branch(
  (props: Props) => !!props.rekeyInfo,
  branch(
    (props: Props) => props.rekeyInfo && props.rekeyInfo.get('rekeyParticipants').count(),
    renderComponent(ParticipantRekey),
    renderComponent(YouRekey)
  )
)(hoc(Conversation))
