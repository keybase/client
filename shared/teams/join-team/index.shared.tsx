import React from 'react'
import {Box, Button, Icon, Text, ButtonBar} from '../../common-adapters/index'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../styles'

import {Props} from '.'

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

export const SuccessComponent = ({successTeamName, onBack}: Props) => (
  <Box style={globalStyles.flexBoxColumn}>
    <Box style={{...styleContainer, backgroundColor: globalColors.blue}}>
      <Text
        style={{margin: globalMargins.tiny, width: '100%'}}
        center={true}
        type="BodySemibold"
        negative={true}
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
        <Icon type={isMobile ? 'icon-fancy-email-sent-192-x-64' : 'icon-fancy-email-sent-144-x-48'} />
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
        <Text center={true} type="Body">
          We sent a request to{' '}
          {successTeamName ? <Text type="BodySemibold">{successTeamName}</Text> : 'the team'}
          's admins. We will notify you as soon as they let you in!
        </Text>
      </Box>
      <ButtonBar>
        <Button onClick={onBack} label="Close" />
      </ButtonBar>
    </Box>
  </Box>
)
