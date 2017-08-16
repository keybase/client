// @flow
import React from 'react'
import {Box, Button, HeaderHoc, Input, PopupDialog, Text} from '../../../common-adapters/index'
import {isMobile} from '../../../constants/platform'
import {globalColors, globalMargins, globalStyles} from '../../../styles'

import type {Props} from './'

const Contents = ({name, onNameChange, onSubmit}: Props) => (
  <Box style={globalStyles.flexBoxColumn}>
    <Box style={styleContainer}>
      <Text
        style={{margin: globalMargins.tiny, textAlign: 'center', width: '100%'}}
        type="BodySemibold"
        backgroundMode="Announcements"
      >
        Team names are unique for security reasons.
      </Text>
    </Box>

    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        ...stylePadding,
        alignItems: 'center',
        justifyContent: 'center',
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

const PopupWrapped = (props: Props) => (
  <PopupDialog onClose={props.onBack}>
    <Contents {...props} />
  </PopupDialog>
)

const styleContainer = {
  ...globalStyles.flexBoxCenter,
  backgroundColor: globalColors.blue,
  cursor: 'default',
  paddingTop: 6,
}

const stylePadding = isMobile
  ? {
      paddingTop: globalMargins.xlarge,
    }
  : {
      marginBottom: 80,
      marginLeft: 80,
      marginRight: 80,
      marginTop: 90,
    }

export default (isMobile ? HeaderHoc(Contents) : PopupWrapped)
