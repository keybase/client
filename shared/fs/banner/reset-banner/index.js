// @flow
import * as React from 'react'
import {Box, Icon, Text, Button, ConnectedUsernames} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import YouAreReset from './you-are-reset'

type Props = {
  isUserReset: boolean,
  resetParticipants: Array<string>,
  onReAddToTeam: (username: string) => () => void,
  onViewProfile: (username: string) => () => void,
  onOpenWithoutResetUsers: () => void,
}

const Banner = ({isUserReset, resetParticipants, onReAddToTeam, onViewProfile, onOpenWithoutResetUsers}: Props) => {
  if (!resetParticipants || resetParticipants.length === 0) {
    return <Box />
  }
  if (isUserReset) {
    return <YouAreReset />
  }
  return (
    <Box style={bannerStyle}>
      <Box style={iconContainerStyle}>
        <Icon type={isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
      </Box>
      <Box style={headerTextContainerStyle}>
        <Box style={globalStyles.flexBoxRow}>
          <Box style={{marginRight: globalMargins.xtiny}}>
            <ConnectedUsernames
              type="BodySemiboldLink"
              showAnd={true}
              inlineGrammar={true}
              commaColor={globalColors.white}
              clickable={true}
              underline={true}
              usernames={resetParticipants}
              style={textStyle}
            />
          </Box>
          <Text type="BodySemibold" style={textStyle}>
            lost all of their devices and{' '}
            {resetParticipants.length === 1 ? 'this account has' : 'these accounts have'} new keys.
          </Text>
        </Box>
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
      <Box style={globalStyles.flexBoxColumn}>
        {resetParticipants.map(p => (
          <Box key={p} style={actionRowStyle}>
            <Button
              type="SecondaryColoredBackground"
              label={'View ' + p + "'s profile"}
              onClick={onViewProfile(p)}
              style={firstButtonStyle}
            />
            <Button
              type="PrimaryColoredBackground"
              backgroundMode="Red"
              label={'Let ' + p + ' back in'}
              onClick={onReAddToTeam(p)}
            />
          </Box>
        ))}
      </Box>
      <Box>
        <Text type="BodySemibold" style={bottomTextStyle}>
          Or until you're sure,{' '}
        </Text>
        <Text type="BodySemiboldLink" onClick={onOpenWithoutResetUsers} style={{...bottomTextStyle, textDecorationLine: 'underline'}}>
          open a folder without any of them.
        </Text>
      </Box>
    </Box>
  )
}

const bannerStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.red,
  alignItems: 'center',
  position: 'relative',
  paddingTop: globalMargins.medium,
  paddingBottom: globalMargins.medium,
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

const firstButtonStyle = {
  marginRight: globalMargins.tiny,
}

const bottomTextStyle = {
  ...textStyle,
  marginTop: globalMargins.tiny,
}

const actionRowStyle = {
  ...globalStyles.flexBoxRow,
  marginBottom: globalMargins.tiny,
}

const iconContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
  marginBottom: globalMargins.medium,
}

export default Banner
