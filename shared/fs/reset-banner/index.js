// @flow
import * as React from 'react'
import {Box, Text, Icon, Button} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'

type Props = {
  isUserReset: boolean,
  resetParticipants: Array<string>,
}

const Banner = ({isUserReset, resetParticipants}: Props) => {
  if (isUserReset) {
    // TODO: implement user's reset banner.
    return <Box />
  }
  return (
    <Box style={bannerStyle}>
      { /* Put in skull image here */ }
      <Box style={headerTextContainerStyle}>
        <Text type="BodySemibold" style={textStyle}>
          foo lost all of their devices and this account has new keys.
        </Text>
        <Text type="BodySemibold" style={textStyle}>
          If you want to let them into this folder and the matching chat, you should either:
        </Text>
      </Box>
      <Box style={listTextContainerStyle}>
        <Text type="BodySemibold" style={listTextContentStyle}>
          1. Be satisfied with their new proofs, or
        </Text>
        <Text type="BodySemibold" style={listTextContentStyle}>
          2. Know them outside Keybase and have gotten a thumbs up from them.
        </Text>
      </Box>
      <Box style={headerTextContainerStyle}>
        <Text type="BodySemibold" style={textStyle}>
          Don't let them in until one of those is true.
        </Text>
      </Box>
      <Box style={globalStyles.flexBoxRow}>
        <Button type="PrimaryColoredBackground" backgroundMode="Red" label="Let them in" onClick={() => undefined} />
        <Button type="SecondaryColoredBackground" label="Check out their profile" onClick={() => undefined} />
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

const bannerStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.red,
  alignItems: 'center',
  position: 'relative',
  paddingTop: globalMargins.large,
  paddingBottom: globalMargins.large,
}

const headerTextContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  paddingBottom: globalMargins.xsmall,
}

const listTextContainerStyle = {
  ...globalStyles.flexBoxColumn,
  paddingLeft: 3 * globalMargins.xlarge,
  width: '100%',
}

const textStyle = {
  color: globalColors.white,
}

const listTextContentStyle = {
  ...textStyle,
  paddingRight: 3 * globalMargins.xlarge,
  paddingBottom: globalMargins.xsmall,
}

export default Banner
