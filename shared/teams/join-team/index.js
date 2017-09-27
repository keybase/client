// @flow
import React from 'react'
import {Box, Button, HeaderHoc, Input, PopupDialog, Text, ScrollView} from '../../common-adapters/index'
import {isMobile} from '../../constants/platform'
import {globalColors, globalMargins, globalStyles} from '../../styles'

import type {Props} from './'

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

const Contents = (props: Props) => (
  <ScrollView>
    {renderContents(props)}
  </ScrollView>
)

const renderContents = ({errorText, successText, successBody, name, onNameChange, onSubmit, onBack}) => {
  if (successText) {
    return (
      <Box style={globalStyles.flexBoxColumn}>
        <Box style={{...styleContainer, backgroundColor: globalColors.blue}}>
          <Text
            style={{margin: globalMargins.tiny, textAlign: 'center', width: '100%'}}
            type="BodySemibold"
            backgroundMode="Announcements"
          >
            {successText}
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
          <Text type="BodySemibold">Yay it worked!</Text>
          <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.xlarge}}>
            <Button type="Primary" style={{marginLeft: globalMargins.tiny}} onClick={onBack} label="Close" />
          </Box>
        </Box>
      </Box>
    )
  } else {
    return (
      <Box style={globalStyles.flexBoxColumn}>
        {errorText &&
          <Box
            style={{
              ...styleContainer,
              backgroundColor: globalColors.red,
            }}
          >
            <Text
              style={{margin: globalMargins.tiny, textAlign: 'center', width: '100%'}}
              type="BodySemibold"
              backgroundMode="HighRisk"
            >
              {errorText}
            </Text>
          </Box>}

        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            ...stylePadding,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text type="BodySemibold">Join a team</Text>
          <Input
            autoFocus={true}
            hintText="Token or team name"
            value={name}
            onChangeText={onNameChange}
            onEnterKeyDown={onSubmit}
          />
          <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.xlarge}}>
            <Button
              type="Primary"
              style={{marginLeft: globalMargins.tiny}}
              onClick={onSubmit}
              label="Continue"
            />
          </Box>
        </Box>
      </Box>
    )
  }
}

const PopupWrapped = (props: Props) => (
  <PopupDialog onClose={props.onBack}>
    <Contents {...props} />
  </PopupDialog>
)

export default (isMobile ? HeaderHoc(Contents) : PopupWrapped)
