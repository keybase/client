// @flow
import React from 'react'
import {Box, Button, Icon, Text} from '../../common-adapters/index'
import {isMobile} from '../../constants/platform'
import {globalColors, globalMargins, globalStyles} from '../../styles'

import type {Props} from '.'

export const styleContainer = {
  ...globalStyles.flexBoxCenter,
  borderTopLeftRadius: isMobile ? 0 : 4,
  borderTopRightRadius: isMobile ? 0 : 4,
  minHeight: 40,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}

export const stylePadding = isMobile
  ? {
      paddingTop: globalMargins.xlarge,
    }
  : {
      marginBottom: 80,
      marginLeft: 80,
      marginRight: 80,
      marginTop: 90,
    }

export const SuccessComponent = ({name, onBack}: Props) => (
  <Box style={globalStyles.flexBoxColumn}>
    <Box style={{...styleContainer, backgroundColor: globalColors.blue}}>
      <Text
        style={{margin: globalMargins.tiny, textAlign: 'center', width: '100%'}}
        type="BodySemibold"
        backgroundMode="Announcements"
      >
        Your request is on its way!
      </Text>
    </Box>

    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        ...stylePadding,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: globalMargins.large,
      }}
    >
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'flex-start',
          justifyContent: 'center',
          width: 240,
        }}
      >
        <Icon type="icon-fancy-email-sent-192-x-64" />
      </Box>
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: globalMargins.large,
          maxWidth: isMobile ? 320 : 410,
        }}
      >
        <Text style={{textAlign: 'center'}} type="Body">
          We sent a request to
          {' '}
          <Text type="BodySemibold">{name}</Text>
          's admins. We will notify you as soon as they let you in!
        </Text>
      </Box>
      <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.large}}>
        <Button type="Primary" style={{marginLeft: globalMargins.tiny}} onClick={onBack} label="Close" />
      </Box>
    </Box>
  </Box>
)
