// @flow
import React from 'react'
import {Box, Button, Header, Input, PopupDialog, Text} from '../../../common-adapters/index'
import {globalColors, globalMargins, globalStyles} from '../../../styles'

import type {Props} from './'

const Contents = ({name, onNameChange, onSubmit}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn}}>
    <Header windowDragging={false} style={{backgroundColor: globalColors.blue}}>
      <Text
        style={{textAlign: 'center', width: '100%', margin: globalMargins.tiny}}
        type="BodySemibold"
        backgroundMode="Announcements"
      >
        Team names are unique for security reasons.
      </Text>
    </Header>

    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        marginBottom: 80,
        marginLeft: 80,
        marginRight: 80,
        marginTop: 90,
      }}
    >
      <Input autoFocus={true} hintText="Name your team" value={name} onChangeText={onNameChange} />
      <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.xlarge}}>
        <Button
          type="Primary"
          style={{marginLeft: globalMargins.tiny}}
          onClick={onSubmit}
          label="Create team"
        />
      </Box>
    </Box>
  </Box>
)

const NewTeamDialog = (props: Props) => (
  <PopupDialog onClose={props.onBack}>
    <Contents {...props} />
  </PopupDialog>
)

export default NewTeamDialog
