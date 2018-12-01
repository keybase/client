// @flow
import * as React from 'react'
import {
  Box,
  ClickableBox,
  Avatar,
  Text,
  Icon,
  ConnectedUsernames,
  OverlayParentHOC,
  type OverlayParentProps,
} from '../../../common-adapters'
import AddPeopleHow from '../../../teams/team/header/add-people-how/container'
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
          <Avatar size={isMobile ? 48 : 32} username={username} />
          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              marginLeft: isMobile ? globalMargins.small : globalMargins.tiny,
            }}
          >
            <ConnectedUsernames colorFollowing={true} type="BodySemibold" usernames={[username]} />
            {fullname !== '' && <Text type="BodySmall">{fullname}</Text>}
          </Box>
        </Box>
      </Box>
    </ClickableBox>
  </Box>
)

const _AddPeople = (props: {teamname: string} & OverlayParentProps) => {
  return (
    <ClickableBox
      style={{...globalStyles.flexBoxRow}}
      onClick={props.toggleShowingMenu}
      ref={props.setAttachmentRef}
    >
      <AddPeopleHow
        attachTo={props.getAttachmentRef}
        visible={props.showingMenu}
        teamname={props.teamname}
        onHidden={props.toggleShowingMenu}
      />
      <Box style={rowStyle}>
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            alignItems: 'center',
            flex: 1,
            marginRight: globalMargins.tiny,
          }}
        >
          <Box style={{height: isMobile ? 48 : 32, width: isMobile ? 48 : 32, ...globalStyles.flexBoxCenter}}>
            <Icon type="iconfont-new" fontSize={isMobile ? 24 : 16} color={globalColors.blue} />
          </Box>
          <Text
            type="BodyPrimaryLink"
            style={{marginLeft: isMobile ? globalMargins.small : globalMargins.tiny}}
          >
            Add someone
          </Text>
        </Box>
      </Box>
    </ClickableBox>
  )
}
const AddPeople = OverlayParentHOC(_AddPeople)

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
