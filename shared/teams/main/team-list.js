// @flow
import * as React from 'react'
import {ClickableBox, Icon, Avatar, Badge, Box, Divider, Text, Meta} from '../../common-adapters'
import {Set} from 'immutable'
import * as Styles from '../../styles'

import type {Teamname, ResetUser} from '../../constants/types/teams'

export type Props = {
  teamnames: Array<Teamname>,
  teammembercounts: {[string]: number},
  teamresetusers: {[string]: Set<ResetUser>},
  teamNameToIsOpen: {[string]: boolean},
  newTeams: Array<Teamname>,
  newTeamRequests: Array<Teamname>,
  onOpenFolder: (teamname: Teamname) => void,
  onManageChat: (teamname: Teamname) => void,
  onViewTeam: (teamname: Teamname) => void,
}

type RowProps = {
  name: Teamname,
  membercount: number,
  isNew: boolean,
  isOpen: boolean,
  newRequests: number,
  onOpenFolder: null | (() => void),
  onManageChat: null | (() => void),
  resetUserCount?: number,
  onViewTeam: () => void,
}

const TeamRow = ({
  name,
  membercount,
  isNew,
  isOpen,
  newRequests,
  onOpenFolder,
  onManageChat,
  onViewTeam,
  resetUserCount,
}: RowProps) => {
  const badgeCount = newRequests + resetUserCount

  return (
    <Box style={styles.rowContainer}>
      <Box style={styles.rowInnerContainer}>
        <ClickableBox style={styles.rowLeftSide} onClick={onViewTeam}>
          <Box style={styles.avatarContainer}>
            <Avatar size={Styles.isMobile ? 48 : 32} teamname={name} isTeam={true} />
            {!!badgeCount && <Badge badgeNumber={badgeCount} badgeStyle={styles.badge} />}
          </Box>
          <Box style={styles.textContainer}>
            <Box style={styles.topLine}>
              <Text type="BodySemibold">{name}</Text>
              {isOpen && (
                <Meta title="open" style={styles.isOpen} backgroundColor={Styles.globalColors.green} />
              )}
            </Box>
            <Box style={styles.bottomLine}>
              {isNew && (
                <Meta title="new" style={styles.isNew} backgroundColor={Styles.globalColors.orange} />
              )}
              <Text type="BodySmall">{membercount + ' member' + (membercount !== 1 ? 's' : '')}</Text>
            </Box>
          </Box>
        </ClickableBox>
        {!Styles.isMobile && onOpenFolder && <Icon type="iconfont-folder-private" onClick={onOpenFolder} />}
        {!Styles.isMobile &&
          onManageChat && (
            <Icon
              type="iconfont-chat"
              style={{marginLeft: Styles.globalMargins.small, marginRight: Styles.globalMargins.tiny}}
              onClick={onManageChat}
            />
          )}
      </Box>
      {!Styles.isMobile && <Divider style={styles.divider} />}
    </Box>
  )
}

const TeamList = (props: Props) => (
  <Box style={styles.teamList}>
    {props.teamnames.map((name, index, arr) => (
      <TeamRow
        key={name}
        name={name}
        isNew={props.newTeams.includes(name)}
        isOpen={props.teamNameToIsOpen[name]}
        newRequests={props.newTeamRequests.filter(team => team === name).length}
        membercount={props.teammembercounts[name]}
        onOpenFolder={() => props.onOpenFolder(name)}
        onManageChat={() => props.onManageChat(name)}
        onViewTeam={() => props.onViewTeam(name)}
        resetUserCount={props.teamresetusers[name] ? props.teamresetusers[name].size : 0}
      />
    ))}
  </Box>
)

const styles = Styles.styleSheetCreate({
  teamList: {
    ...Styles.globalStyles.flexBoxColumn,
    width: '100%',
    marginLeft: Styles.globalMargins.tiny,
  },
  isOpen: {
    alignSelf: 'center',
    marginLeft: 4,
  },
  isNew: {
    alignSelf: 'center',
    marginRight: 4,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
  },
  divider: {
    marginLeft: 48,
  },
  rowContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    flexShrink: 0,
    minHeight: Styles.isMobile ? 64 : 48,
  },
  rowLeftSide: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flex: 1,
  },
  rowInnerContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flex: 1,
    marginRight: Styles.globalMargins.tiny,
  },
  avatarContainer: {
    display: 'flex',
    position: 'relative',
  },
  textContainer: {...Styles.globalStyles.flexBoxColumn, flex: 1, marginLeft: Styles.globalMargins.small},
  topLine: {...Styles.globalStyles.flexBoxRow},
  bottomLine: {...Styles.globalStyles.flexBoxRow, alignItems: 'center'},
})

export default TeamList
export {TeamRow}
