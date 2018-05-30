// @flow
import * as React from 'react'
import {Box, Text, Icon, Button} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'

type Props = {
  showBanner: boolean,
  resetParticipants: Array<string>,
}

const Banner = ({showBanner, resetParticipants}: Props) => {
  if (!showBanner) {
    return null
  }
  const iconType = 'icon-fancy-finder-132-96'
  const bannerStyle = {
    ...globalStyles.flexBoxRow,
    backgroundColor: globalColors.red,
    alignItems: 'center',
    position: 'relative',
  }
  const bannerContent = (
    <Box style={globalStyles.flexBoxColumn}>
      <Text type="Header" style={textStyle}>
        Reset Header
      </Text>
      <Text type="BodySemibold" style={textStyle}>
        Reset Content
      </Text>
      <Box style={{justifyContent: 'flex-start'}}>
        <Button type="PrimaryGreen" label="Yes, enable" onClick={() => undefined} />
      </Box>
    </Box>
  )
  return (
    <Box style={bannerStyle}>
      <Box style={bannerIconStyle}>
        <Icon type={iconType} />
      </Box>
      <Box style={bannerTextContentStyle}>{bannerContent}</Box>
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

const textStyle = {
  color: globalColors.white,
  paddingBottom: globalMargins.small,
}

export default Banner
