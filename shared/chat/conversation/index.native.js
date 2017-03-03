// @flow
import Header from './header.native'
import Input from './input.native'
import List from './list.native'
import OldProfileResetNotice from './notices/old-profile-reset-notice'
import React from 'react'
import hoc from './index-hoc'
import {Box} from '../../common-adapters'
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

export default hoc(Conversation)
