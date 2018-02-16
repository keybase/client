// @flow
import React from 'react'
import {
  Box,
  Button,
  Checkbox,
  HeaderHoc,
  Input,
  PopupDialog,
  Text,
  ScrollView,
} from '../../common-adapters/index'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../styles'

import type {Props} from './'

// This logic is copied from go/protocol/keybase1/extras.go.

const headerText = (baseTeam: string, errorText: string, isSubteam: boolean): string => {
  if (errorText) {
    return errorText
  }

  // TODO: Display an error and disable the submit button if name
  // isn't a valid teamname.
  return isSubteam
    ? `You're creating a subteam of ${baseTeam}.`
    : "For security reasons, team names are unique and can't be changed, so choose carefully."
}

const Contents = ({
  errorText,
  baseTeam,
  isSubteam,
  joinSubteam,
  name,
  onJoinSubteamChange,
  onNameChange,
  onSubmit,
  pending,
}: Props) => (
  <ScrollView>
    <Box style={globalStyles.flexBoxColumn}>
      <Box style={{...styleContainer, backgroundColor: errorText ? globalColors.red : globalColors.blue}}>
        <Text
          style={{margin: globalMargins.tiny, textAlign: 'center', width: '100%'}}
          type="BodySemibold"
          backgroundMode={errorText ? 'HighRisk' : 'Announcements'}
        >
          {headerText(baseTeam, errorText, isSubteam)}
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
        <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.medium}}>
          <Input
            autoFocus={true}
            hintText="Name your team"
            value={name}
            onChangeText={onNameChange}
            onEnterKeyDown={onSubmit}
            disabled={pending}
          />
        </Box>

        {isSubteam && (
          <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.medium}}>
            <Checkbox
              checked={joinSubteam}
              label="Join this subteam after creating it."
              onCheck={onJoinSubteamChange}
            />
          </Box>
        )}

        <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.large}}>
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
