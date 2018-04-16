// @flow
import * as React from 'react'
import {Box, ClickableBox, Avatar, Text, Icon, ConnectedUsernames} from '../../../common-adapters'
import {
  globalColors,
  globalStyles,
  globalMargins,
  isMobile,
  desktopStyles,
  platformStyles,
} from '../../../styles'

type Props = {
  fullname: string,
  username: string,
  onShowProfile: (username: string) => void,
}

const Participant = ({fullname, username, onShowProfile}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, paddingTop: globalMargins.tiny}}>
    <ClickableBox key={username} onClick={() => onShowProfile(username)}>
      <Box style={rowStyle}>
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            alignItems: 'center',
            flex: 1,
            marginRight: globalMargins.tiny,
          }}
        >
          <Avatar size={isMobile ? 40 : 32} username={username} />
          <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
            <ConnectedUsernames colorFollowing={true} type="BodySemibold" usernames={[username]} />
            {fullname !== '' && <Text type="BodySmall">{fullname}</Text>}
          </Box>
        </Box>
      </Box>
    </ClickableBox>
  </Box>
)

const AddPeople = ({onClick}: {onClick: (?Element) => void}) => (
  <ClickableBox
    style={{...globalStyles.flexBoxRow}}
    onClick={evt => (isMobile ? onClick() : onClick(evt.currentTarget))}
  >
    <Box style={rowStyle}>
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          flex: 1,
          marginRight: globalMargins.tiny,
        }}
      >
        <Box style={{width: isMobile ? 40 : 32, height: isMobile ? 40 : 32, ...globalStyles.flexBoxCenter}}>
          <Icon type="iconfont-new" fontSize={isMobile ? 24 : 16} color={globalColors.blue} />
        </Box>
        <Text type="BodyPrimaryLink" style={{marginLeft: globalMargins.small}}>
          Add someone
        </Text>
      </Box>
    </Box>
  </ClickableBox>
)

const rowStyle = platformStyles({
  common: {
    ...globalStyles.flexBoxColumn,
    minHeight: 48,
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
  },
  isElectron: {
    ...desktopStyles.clickable,
  },
  isMobile: {
    minHeight: 56,
  },
})

export {AddPeople}
export default Participant
