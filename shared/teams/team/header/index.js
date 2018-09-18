// @flow
import * as React from 'react'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import AddPeopleHow from './add-people-how/container'
import {
  iconCastPlatformStyles,
  Box,
  Button,
  ButtonBar,
  Icon,
  InfoNote,
  Meta,
  Text,
  OverlayParentHOC,
  type OverlayParentProps,
} from '../../../common-adapters'
import type {Response} from 'react-native-image-picker'
import NameWithIconWrapper from './name-with-icon-wrapper'
import {
  desktopStyles,
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
  onAddSelf: () => void,
  onChat: () => void,
  onEditDescription: () => void,
  onEditIcon: (image?: Response) => void,
} & OverlayParentProps

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
      <NameWithIconWrapper
        canEditDescription={props.canEditDescription}
        onEditIcon={props.onEditIcon}
        teamname={props.teamname}
        metaOne={
          <Box style={globalStyles.flexBoxRow}>
            <Text type="BodySmall">TEAM</Text>
            {props.openTeam && <Meta style={styles.meta} title="open" backgroundColor={globalColors.green} />}
          </Box>
        }
        metaTwo={getTeamSubtitle(props.memberCount, props.role)}
      />

      {/* Description */}
      {props.canEditDescription || props.description ? (
        <Text
          className={props.description ? 'hover-underline' : ''}
          style={collapseStyles([
            styles.description,
            platformStyles({
              common: {
                color: props.description ? globalColors.black_75 : globalColors.black_20,
              },
              isElectron: {
                ...(props.description ? desktopStyles.editable : desktopStyles.clickable),
              },
            }),
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
        {props.canChat && (
          <Button type="Primary" label="Chat" onClick={props.onChat}>
            <Icon
              type="iconfont-chat"
              style={iconCastPlatformStyles(styles.chatIcon)}
              color={globalColors.white}
              size={22}
            />
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
        attachTo={props.getAttachmentRef}
        visible={props.showingMenu}
        teamname={props.teamname}
        onHidden={props.toggleShowingMenu}
      />

      {/* CLI hint */}
      {!isMobile && (
        <InfoNote>
          <Text type="BodySmall">You can also manage teams from the terminal:</Text>
          <Text type="TerminalInline" selectable={true} style={styles.cliTerminalText}>
            keybase team --help
          </Text>
        </InfoNote>
      )}
    </Box>
  </Box>
)

const TeamHeader = OverlayParentHOC(_TeamHeader)

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
    textAlign: 'center',
  },
  meta: {
    alignSelf: 'center',
    marginLeft: globalMargins.tiny,
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
