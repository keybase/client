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

const Banner = ({
  isUserReset,
  resetParticipants,
  onReAddToTeam,
  onViewProfile,
  onOpenWithoutResetUsers,
}: Props) => {
  if (!resetParticipants || resetParticipants.length === 0) {
    return <Box />
  }
  if (isUserReset) {
    return <YouAreReset />
  }
  return (
    <Box style={bannerStyle}>
      <Icon
        type={isMobile ? 'icon-skull-64' : 'icon-skull-48'}
        style={{height: globalMargins.xlarge, margin: globalMargins.medium}}
      />
      <Box style={textContainerStyle}>
        <Box style={globalStyles.flexBoxRow}>
          <Text
            type="BodySemibold"
            backgroundMode="Terminal"
            style={{paddingLeft: globalMargins.large, paddingRight: globalMargins.large}}
          >
            <ConnectedUsernames
              type="BodySemiboldLink"
              showAnd={true}
              inline={true}
              inlineGrammar={true}
              commaColor={globalColors.white}
              onUsernameClicked="profile"
              underline={true}
              usernames={resetParticipants}
              backgroundMode="Terminal"
            />
            &nbsp;
            {// This needs to be in the same node as the sister
            // ConnectedUsernames node, because otherwise it gets re-flowed
            // awkwardly.
            'lost all of their devices and ' +
              (resetParticipants.length === 1 ? 'this account has' : 'these accounts have') +
              ' new keys.\n' +
              'If you want to let them into this folder and the matching chat, you should either:'}
          </Text>
        </Box>
      </Box>
      <Box style={listTextContainerStyle}>
        <Text type="BodySemibold" backgroundMode="Terminal" style={listTextContentStyle}>
          1. Be satisfied with their new proofs, or
        </Text>
        <Text type="BodySemibold" backgroundMode="Terminal" style={listTextContentStyle}>
          2. Know them outside Keybase and have gotten a thumbs up from them.
        </Text>
      </Box>
      <Box style={textContainerStyle}>
        <Text type="BodySemibold" backgroundMode="Terminal">
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
        <Text type="BodySemibold" backgroundMode="Terminal">
          Or until you're sure,{' '}
        </Text>
        <Text
          type="BodySemiboldLink"
          backgroundMode="Terminal"
          onClick={onOpenWithoutResetUsers}
          style={bottomTextStyle}
        >
          open a folder without any of them.
        </Text>
      </Box>
    </Box>
  )
}

const bannerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.red,
  paddingBottom: globalMargins.medium,
  paddingTop: globalMargins.medium,
}

const textContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.red,
  padding: globalMargins.small,
}

const listTextContainerStyle = {
  ...globalStyles.flexBoxColumn,
  maxWidth: isMobile ? 280 : 400,
}

const textStyle = {
  color: globalColors.white,
}

const listTextContentStyle = {
  marginTop: globalMargins.tiny,
}

const firstButtonStyle = {
  marginBottom: isMobile ? globalMargins.tiny : 0,
  marginRight: globalMargins.tiny,
}

const bottomTextStyle = {
  ...textStyle,
  marginTop: globalMargins.tiny,
  textDecorationLine: 'underline',
}

const actionRowStyle = {
  ...(isMobile ? globalStyles.flexBoxColumn : globalStyles.flexBoxRow),
  marginBottom: globalMargins.tiny,
}

export default Banner
