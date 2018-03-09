// @flow
import * as React from 'react'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import {Box, Text, Icon, Button, Checkbox} from '../../common-adapters'
import {type Props} from '.'
import {fileUIName} from '../../constants/platform'

const checkBoxComponent = (kbfsEnabled: boolean) => (
  <Box style={globalStyles.flexBoxColumn}>
    <Text type="Body">Enable Keybase in {fileUIName}</Text>
    <Text type="BodySmall">Access your Keybase files just like you normally do with your local files.</Text>
  </Box>
)

const Files = ({kbfsEnabled}: Props) => {
  const iconType = kbfsEnabled ? 'icon-fancy-finder-enabled-132-96' : 'icon-fancy-finder-132-96'
  const bannerStyle = {
    ...globalStyles.flexBoxRow,
    backgroundColor: kbfsEnabled ? globalColors.green : globalColors.blue,
    height: 176,
    alignItems: 'center',
  }
  let bannerContent
  if (kbfsEnabled) {
    bannerContent = (
      <Text type="Header" style={textStyle}>
        Keybase is enabled in your {fileUIName}.
      </Text>
    )
  } else {
    bannerContent = (
      <Box style={globalStyles.flexBoxColumn}>
        <Text type="Header" style={textStyle}>
          Enable Keybase in {fileUIName}?
        </Text>
        <Text type="BodySemibold" style={textStyle}>
          Get access to your files and folders just like you normally do with your local files. It's encrypted
          and secure.
        </Text>
        <Box style={{justifyContent: 'flex-start'}}>
          <Button type="PrimaryGreen" label="Yes, enable" onClick={() => undefined} />
        </Box>
      </Box>
    )
  }
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Box style={bannerStyle}>
        <Box style={bannerIconStyle}>
          <Icon type={iconType} />
        </Box>
        <Box style={bannerTextContentStyle}>{bannerContent}</Box>
      </Box>
      <Box style={mainContentStyle}>
        <Box style={contentHeaderStyle}>
          <Text type="BodySmallSemibold">{fileUIName} integration</Text>
          <Icon type="iconfont-finder" style={contentHeaderIconStyle} />
        </Box>
        <Checkbox
          onCheck={() => undefined}
          labelComponent={checkBoxComponent(kbfsEnabled)}
          checked={kbfsEnabled}
        />
      </Box>
    </Box>
  )
}

const sidePadding = globalMargins.large + globalMargins.tiny
const bannerIconStyle = {
  paddingLeft: sidePadding,
  paddingRight: sidePadding,
  paddingTop: globalMargins.large,
  paddingBottom: globalMargins.medium,
}

const bannerTextContentStyle = {
  alignItems: 'center',
  paddingRight: globalMargins.xlarge + globalMargins.medium,
}

const mainContentStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  paddingTop: globalMargins.medium,
  paddingLeft: globalMargins.tiny,
}

const contentHeaderStyle = {
  ...globalStyles.flexBoxRow,
  paddingBottom: globalMargins.tiny,
}

const contentHeaderIconStyle = {
  fontSize: 16,
  color: globalColors.black_20,
  paddingLeft: globalMargins.tiny,
}

const textStyle = {
  color: globalColors.white,
  paddingBottom: globalMargins.small,
}

export default Files
