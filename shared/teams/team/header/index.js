// @flow
import * as React from 'react'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import AddPeopleHow from './add-people-how/container'
import {
  Box,
  Button,
  ButtonBar,
  Icon,
  Meta,
  NameWithIcon,
  ProgressIndicator,
  Text,
} from '../../../common-adapters'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../../common-adapters/floating-menu'
import {
  collapseStyles,
  globalColors,
  globalMargins,
  globalStyles,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../../../styles'

export type Props = {
  canChat: boolean,
  canEditDescription: boolean,
  canJoinTeam: boolean,
  canManageMembers: boolean,
  description: string,
  loading?: boolean,
  memberCount: number,
  openTeam: boolean,
  role: Types.MaybeTeamRoleType,
  showingMenu: boolean,
  teamname: Types.Teamname,
  onAddPeople: (target?: any) => void,
  onAddSelf: () => void,
  onChat: () => void,
  onEditDescription: () => void,
} & FloatingMenuParentProps

const _TeamHeader = (props: Props) => (
  <Box style={styles.container}>
    {props.canJoinTeam && (
      <Box key="add yourself" style={styles.addYourselfBanner}>
        <Text type="BodySemibold" style={styles.addYourselfBannerText}>
          You are not a member of this team.
        </Text>
        <Text
          backgroundMode="Information"
          type="BodySemiboldLink"
          style={styles.addYourselfBannerText}
          onClick={props.onAddSelf}
          underline={true}
        >
          Add yourself
        </Text>
      </Box>
    )}
    <Box style={styles.teamHeader}>
      {/* Summary */}
      <NameWithIcon
        size="large"
        teamname={props.teamname}
        title={props.teamname}
        metaOne={
          <Box style={globalStyles.flexBoxRow}>
            <Text type="BodySmall">TEAM</Text>
            {props.openTeam && <Meta style={styles.meta} title="open" backgroundColor={globalColors.green} />}
          </Box>
        }
        metaTwo={getTeamSubtitle(props.memberCount, props.role)}
      />

      {/* Description */}
      {!props.loading && (props.canEditDescription || props.description) ? (
        <Text
          style={collapseStyles([
            styles.description,
            {
              color: props.description ? globalColors.black_75 : globalColors.black_20,
            },
          ])}
          onClick={props.canEditDescription ? props.onEditDescription : null}
          type={props.canEditDescription ? 'BodySecondaryLink' : 'Body'}
        >
          {props.description || (props.canEditDescription && 'Write a brief description')}
        </Text>
      ) : (
        <Box />
      )}

      {/* Actions */}
      <ButtonBar direction="row" style={styles.buttonBar}>
        {props.loading && <ProgressIndicator style={styles.progressIndicator} />}
        {props.canChat && (
          <Button type="Primary" label="Chat" onClick={props.onChat}>
            <Icon type="iconfont-chat" style={styles.chatIcon} color={globalColors.white} size={22} />
          </Button>
        )}
        {props.canManageMembers && (
          <Button
            type="Secondary"
            label={'Add people...'}
            ref={isMobile ? undefined : props.setAttachmentRef}
            onClick={props.toggleShowingMenu}
          />
        )}
      </ButtonBar>

      {/* Add people how dropdown */}
      <AddPeopleHow
        attachTo={props.attachmentRef}
        visible={props.showingMenu}
        teamname={props.teamname}
        onHidden={props.toggleShowingMenu}
      />

      {/* CLI hint */}
      {!isMobile && (
        <Box style={styles.cliContainer}>
          <Box style={styles.cliIconWrapper}>
            <Box style={styles.cliIconLine} />
            <Icon style={styles.cliIcon} color={globalColors.black_10} type="iconfont-info" />
            <Box style={styles.cliIconLine} />
          </Box>
          <Text type="BodySmall" style={styles.cliInstructionText}>
            You can also manage teams from the terminal:
          </Text>
          <Text type="TerminalInline" selectable={true} style={styles.cliTerminalText}>
            keybase team --help
          </Text>
        </Box>
      )}
    </Box>
  </Box>
)

const TeamHeader = FloatingMenuParentHOC(_TeamHeader)

const getTeamSubtitle = (memberCount: number, role: Types.MaybeTeamRoleType): string => {
  let res = `${memberCount} member`
  if (memberCount !== 1) {
    res += 's'
  }
  if (role && role !== 'none') {
    res += ` • ${Constants.typeToLabel[role]}`
  }
  return res
}

const styles = styleSheetCreate({
  addYourselfBanner: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: globalColors.blue,
    justifyContent: 'center',
    marginBottom: globalMargins.tiny,
    minHeight: 40,
    paddingBottom: globalMargins.tiny,
    paddingLeft: globalMargins.medium,
    paddingRight: globalMargins.medium,
    paddingTop: globalMargins.tiny,
  },
  addYourselfBannerText: {
    color: globalColors.white,
    textAlign: 'center',
  },
  buttonBar: platformStyles({
    isMobile: {
      marginBottom: -8,
      width: 'auto',
    },
  }),
  chatIcon: {
    marginRight: 8,
  },
  cliContainer: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    margin: 20,
  },
  cliIcon: {
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
  },
  cliIconLine: {
    backgroundColor: globalColors.black_05,
    height: 1,
    width: 24,
  },
  cliIconWrapper: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    marginBottom: globalMargins.xtiny,
  },
  cliInstructionText: {
    textAlign: 'center',
  },
  cliTerminalText: {
    marginLeft: globalMargins.xtiny,
    marginTop: globalMargins.xtiny,
  },
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  description: {
    maxWidth: 560,
    paddingTop: globalMargins.tiny,
  },
  meta: {
    alignSelf: 'center',
    marginLeft: globalMargins.tiny,
  },
  progressIndicator: {
    height: 17,
    width: 17,
  },
  teamHeader: platformStyles({
    common: {
      ...globalStyles.flexBoxColumn,
      alignItems: 'center',
      paddingLeft: globalMargins.medium,
      paddingRight: globalMargins.medium,
      paddingTop: globalMargins.tiny,
    },
    isElectron: {
      paddingTop: globalMargins.medium,
      textAlign: 'center',
    },
  }),
})

export {TeamHeader}
