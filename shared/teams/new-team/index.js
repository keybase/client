// @flow
import React from 'react'
import {Box, Button, HeaderHoc, Input, PopupDialog, Text, ScrollView} from '../../common-adapters/index'
import {isMobile} from '../../constants/platform'
import {globalColors, globalMargins, globalStyles} from '../../styles'

import type {Props} from './'

const validTeamname = (s: string): boolean => {
  // This logic is copied from go/protocol/keybase1/extras.go.
  if (s.length < 2 || s.length > 16) {
    return false
  }

  return /^([a-zA-Z0-9][a-zA-Z0-9_]?)+$/.test(s)
}

const headerText = (errorText: string, name: string): string => {
  if (errorText) {
    return errorText
  }

  const i = name.indexOf('.')
  if (i >= 0) {
    const teamname = name.substring(0, i)
    if (validTeamname(teamname)) {
      return `You're creating a subteam of ${teamname}.`
    }
    // TODO: Display an error if teamname isn't valid.
  }

  return "For security reasons, team names are unique and can't be changed, so choose carefully."
}

const Contents = ({errorText, name, onNameChange, onSubmit, pending}: Props) => (
  <ScrollView>
    <Box style={globalStyles.flexBoxColumn}>
      <Box style={{...styleContainer, backgroundColor: errorText ? globalColors.red : globalColors.blue}}>
        <Text
          style={{margin: globalMargins.tiny, textAlign: 'center', width: '100%'}}
          type="BodySemibold"
          backgroundMode={errorText ? 'HighRisk' : 'Announcements'}
        >
          {headerText(errorText, name)}
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
          disabled={pending}
        />
        <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.xlarge}}>
          <Button
            type="Primary"
            style={{marginLeft: globalMargins.tiny}}
            onClick={onSubmit}
            label="Create team"
            disabled={pending}
          />
        </Box>
      </Box>
    </Box>
  </ScrollView>
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
  borderTopLeftRadius: isMobile ? 0 : 4,
  borderTopRightRadius: isMobile ? 0 : 4,
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
