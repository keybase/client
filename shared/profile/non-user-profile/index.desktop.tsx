import * as React from 'react'
import {Avatar, BackButton, Box, Button, Icon, Text} from '../../common-adapters'
import {capitalize} from 'lodash-es'
import {globalColors, globalStyles, globalMargins, platformStyles, desktopStyles} from '../../styles'
import {platformToLogo24} from '../../constants/search'
import {AVATAR_SIZE} from '../../constants/profile'
import {Props} from '.'

const HEADER_TOP_SPACE = 48
const HEADER_SIZE = AVATAR_SIZE / 2 + HEADER_TOP_SPACE

const NonUserRender = (props: Props) => (
  <Box style={styleContainer}>
    <Box style={{...styleHeader, backgroundColor: globalColors.blue}} />
    <Box style={globalStyles.flexBoxColumn}>
      <BackButton
        onClick={props.onBack}
        style={{left: 14, position: 'absolute', top: 16, zIndex: 12}}
        textStyle={{color: globalColors.white}}
        iconColor={globalColors.white}
      />
    </Box>
    <Box style={globalStyles.flexBoxRow}>
      <Box style={styleLeftColumn}>
        <Box style={styleBioBlurb}>
          <Avatar size={AVATAR_SIZE} />
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
          />
          <Button
            style={{marginTop: globalMargins.tiny}}
            onClick={props.onOpenPrivateFolder}
            label="Open private folder"
            type="Dim"
          />
        </Box>
      </Box>
      <Box style={styleRightColumn}>
        <Text center={true} type="BodySmall" style={styleDetails}>{`When ${
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
  height: '100%',
  position: 'relative',
}

const styleHeader = {
  height: HEADER_SIZE,
  position: 'absolute',
  width: '100%',
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
  color: globalColors.black,
  marginTop: 2,
}

const styleServiceLabel = platformStyles({
  common: {
    fontSize: 12,
    lineHeight: 16,
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
}

export default NonUserRender
