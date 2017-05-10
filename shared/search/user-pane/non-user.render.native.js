// @flow
import React from 'react'
import openURL from '../../util/open-url'
import {Avatar, Box, Icon, Text, HeaderHoc} from '../../common-adapters'
import {capitalize} from 'lodash'
import {globalColors, globalStyles, globalMargins} from '../../styles'
import {platformToLogo24} from '../../constants/search'

import type {Props} from './non-user.render'

const NonUserRender = (props: Props) => (
  <Box style={styleContainer}>
    <Box style={{...styleHeader, backgroundColor: globalColors.blue}} />
    <Box style={styleBioBlurb}>
      <Avatar style={globalStyles.clickable} onClick={() => openURL(props.profileUrl)} url={props.avatar} size={112} />
      <Box style={styleUsernameRow} onClick={() => openURL(props.profileUrl)}>
        <Icon type={platformToLogo24(props.serviceName)} />
        <Text type='HeaderBig' style={styleUsername}>{props.username}</Text>
      </Box>
      {props.fullname && <Text type='BodySemibold' style={styleFullname}>{props.fullname}</Text>}
      <Text type='BodySmall' style={styleServiceLabel}>{capitalize(props.serviceName)} user</Text>
    </Box>
    <Text type='BodySmall' style={styleDetails}>{`When ${props.username} connects Keybase and their ${capitalize(props.serviceName)} account, your computer will verify them and rekey the folder or conversation.`}</Text>
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
  ...globalStyles.clickable,
  alignItems: 'center',
  marginTop: globalMargins.tiny,
}

const styleUsername = {
  ...globalStyles.selectable,
  marginLeft: globalMargins.xtiny,
}

const styleFullname = {
  ...globalStyles.selectable,
  color: globalColors.black_75,
  marginTop: 2,
}

const styleServiceLabel = {
  fontSize: 11,
  lineHeight: 14,
  marginTop: globalMargins.xtiny,
}

const styleDetails = {
  marginLeft: globalMargins.medium,
  marginRight: globalMargins.medium,
  marginTop: globalMargins.medium,
  textAlign: 'center',
}

export default HeaderHoc(NonUserRender)
