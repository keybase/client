// @flow
import * as React from 'react'
import {Avatar, BackButton, Box, Button, Icon, Text} from '../common-adapters'
import capitalize from 'lodash/capitalize'
import {globalColors, globalStyles, globalMargins, platformStyles, desktopStyles} from '../styles'
import {platformToLogo24} from '../constants/search'
import {AVATAR_SIZE, HEADER_SIZE} from '../profile/index.desktop'

import type {Props} from './non-user-profile'

const NonUserRender = (props: Props) => (
  <Box style={styleContainer}>
    <Box style={{...styleHeader, backgroundColor: globalColors.blue}} />
    <Box style={globalStyles.flexBoxColumn}>
      <BackButton
        onClick={props.onBack}
        style={{left: 14, position: 'absolute', top: 16, zIndex: 12}}
        textStyle={{color: globalColors.white}}
        iconStyle={{color: globalColors.white}}
      />
    </Box>
    <Box style={globalStyles.flexBoxRow}>
      <Box style={styleLeftColumn}>
        <Box style={styleBioBlurb}>
          <Avatar url={props.avatar} size={AVATAR_SIZE} />
          <Box style={styleUsernameRow}>
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
            {props.serviceName} user
          </Text>
          <Button
            style={{marginTop: globalMargins.medium}}
            onClick={props.onStartChat}
            label="Start a chat"
            type="Primary"
          />
          <Button
            style={{marginTop: globalMargins.tiny}}
            onClick={props.onOpenPrivateFolder}
            label="Open private folder"
            type="Secondary"
          />
        </Box>
      </Box>
      <Box style={styleRightColumn}>
        <Text type="BodySmall" style={styleDetails}>{`When ${
          props.username
        } connects Keybase and their ${capitalize(
          props.serviceName
        )} account, your computer will verify them and rekey the folder or conversation.`}</Text>
      </Box>
    </Box>
  </Box>
)

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  position: 'relative',
  height: '100%',
}

const styleHeader = {
  position: 'absolute',
  width: '100%',
  height: HEADER_SIZE,
}

const styleBioBlurb = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'flex-start',
  paddingTop: 48,
}

const styleLeftColumn = {
  ...globalStyles.flexBoxColumn,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  width: '50%',
}

const styleRightColumn = {
  ...globalStyles.flexBoxColumn,
  marginTop: 130,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  width: 320,
}

const styleUsernameRow = {
  ...globalStyles.flexBoxRow,
  ...desktopStyles.clickable,
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
    fontSize: 11,
    lineHeight: 14,
    marginTop: globalMargins.xtiny,
  },
  isElectron: {
    textTransform: 'uppercase',
  },
})

const styleDetails = {
  marginLeft: globalMargins.medium,
  marginRight: globalMargins.medium,
  marginTop: globalMargins.large,
  textAlign: 'center',
}

export default NonUserRender
