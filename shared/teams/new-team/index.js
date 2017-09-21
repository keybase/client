// @flow
import React from 'react'
import {Box, Button, HeaderHoc, Input, PopupDialog, Text} from '../../common-adapters/index'
import {isMobile} from '../../constants/platform'
import {globalColors, globalMargins, globalStyles} from '../../styles'

import type {Props} from './'

const Contents = ({errorText, name, onNameChange, onSubmit}: Props) => (
  <Box style={globalStyles.flexBoxColumn}>
    <Box style={{...styleContainer, backgroundColor: errorText ? globalColors.red : globalColors.blue}}>
      <Text
        style={{margin: globalMargins.tiny, textAlign: 'center', width: '100%'}}
        type="BodySemibold"
        backgroundMode={errorText ? 'HighRisk' : 'Announcements'}
      >
        {errorText ||
          "For security reasons, team names are unique and can't be changed, so choose carefully."}
      </Text>
    </Box>

    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        ...stylePadding,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: globalColors.white,
      }}
    >
      <Input
        autoFocus={true}
        hintText="Name your team"
        value={name}
        onChangeText={onNameChange}
        onEnterKeyDown={onSubmit}
      />
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
  ...(isMobile ? {} : {cursor: 'default'}),
  minHeight: 40,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  borderTopLeftRadius: 4,
  borderTopRightRadius: 4,
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
