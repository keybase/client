// @flow
import * as React from 'react'
import openURL from '../util/open-url'
import {Avatar, Box, Button, Icon, Text, HeaderHoc} from '../common-adapters'
import capitalize from 'lodash/capitalize'
import {globalColors, globalStyles, globalMargins, platformStyles} from '../styles'
import {platformToLogo24} from '../constants/search'

import type {Props} from './non-user-profile'

const NonUserRender = (props: Props) => (
  <Box style={styleContainer}>
    <Box style={{...styleHeader, backgroundColor: globalColors.blue}} />
    <Box style={styleBioBlurb}>
      <Avatar onClick={() => openURL(props.profileUrl)} url={props.avatar} size={112} />
      <Box style={styleUsernameRow} onClick={() => openURL(props.profileUrl)}>
        <Icon type={platformToLogo24(props.serviceName)} />
        <Text type="HeaderBig" selectable={true} style={styleUsername}>
          {props.username}
        </Text>
      </Box>
      {props.fullname && (
        <Text type="BodySemibold" selectable={true} style={styleFullname}>
          {props.fullname}
        </Text>
      )}
      <Text type="BodySmall" style={styleServiceLabel}>
        {capitalize(props.serviceName)} user
      </Text>
    </Box>
    <Button
      style={{marginTop: globalMargins.medium}}
      onClick={props.onStartChat}
      label="Start a chat"
      type="Primary"
    />
    <Text type="BodySmall" style={styleDetails}>{`When ${
      props.username
    } connects Keybase and their ${capitalize(
      props.serviceName
    )} account, your computer will verify them and rekey the folder or conversation.`}</Text>
  </Box>
)

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  position: 'relative',
}

const styleHeader = {
  position: 'absolute',
  width: '100%',
}

const styleBioBlurb = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'flex-start',
  paddingTop: globalMargins.medium,
}

const styleUsernameRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  marginTop: globalMargins.tiny,
}

const styleUsername = {
  marginLeft: globalMargins.xtiny,
}

const styleFullname = {
  color: globalColors.black_75,
  marginTop: 2,
}

const styleServiceLabel = platformStyles({
  common: {
    fontSize: 13,
    lineHeight: 17,
    marginTop: globalMargins.xtiny,
  },
})

const styleDetails = {
  marginLeft: globalMargins.medium,
  marginRight: globalMargins.medium,
  marginTop: globalMargins.medium,
  textAlign: 'center',
}

export default HeaderHoc(NonUserRender)
