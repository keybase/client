import * as React from 'react'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as Kb from '../../../common-adapters'
import AddPeopleHow from './add-people-how/container'
import NameWithIconWrapper from './name-with-icon-wrapper'
import * as Styles from '../../../styles'
import * as ImagePicker from 'expo-image-picker'

export type Props = {
  canChat: boolean
  canEditDescription: boolean
  canJoinTeam: boolean
  canManageMembers: boolean
  description: string
  loading?: boolean
  memberCount: number
  openTeam: boolean
  role: Types.MaybeTeamRoleType
  showingMenu: boolean
  teamname: Types.Teamname
  onAddSelf: () => void
  onChat: () => void
  onEditDescription: () => void
  onEditIcon: (image?: ImagePicker.ImagePickerResult) => void
  onFilePickerError: (error: Error) => void
  onRename: (() => void) | null
} & Kb.OverlayParentProps

const _TeamHeader = (props: Props) => (
  <Kb.Box style={styles.container}>
    {props.canJoinTeam && (
      <Kb.Box key="add yourself" style={styles.addYourselfBanner}>
        <Kb.Text center={true} type="BodySemibold" style={styles.addYourselfBannerText}>
          You are not a member of this team.
        </Kb.Text>
        <Kb.Text
          type="BodySemiboldLink"
          center={true}
          style={styles.addYourselfBannerText}
          onClick={props.onAddSelf}
          underline={true}
        >
          Add yourself
        </Kb.Text>
      </Kb.Box>
    )}
    <Kb.Box style={styles.teamHeader}>
      {/* Summary */}
      <NameWithIconWrapper
        canEditDescription={props.canEditDescription}
        onEditIcon={props.onEditIcon}
        onFilePickerError={props.onFilePickerError}
        teamname={props.teamname}
        title={
          props.onRename ? (
            <Kb.Box2 direction="horizontal" alignItems="flex-end" gap="xtiny">
              <Kb.Text type="HeaderBig" lineClamp={1}>
                {props.teamname}
              </Kb.Text>
              <Kb.Icon type="iconfont-edit" onClick={props.onRename} />
            </Kb.Box2>
          ) : (
            props.teamname
          )
        }
        metaOne={
          <Kb.Box style={Styles.globalStyles.flexBoxRow}>
            <Kb.Text type="BodySmall">TEAM</Kb.Text>
            {props.openTeam && (
              <Kb.Meta style={styles.meta} title="open" backgroundColor={Styles.globalColors.green} />
            )}
          </Kb.Box>
        }
        metaTwo={getTeamSubtitle(props.memberCount, props.role)}
      />

      {/* Description */}
      {props.canEditDescription || props.description ? (
        <Kb.Text
          center={true}
          className={Styles.classNames({'hover-underline': props.description})}
          style={Styles.collapseStyles([
            styles.description,
            Styles.platformStyles({
              common: {
                color: props.description ? Styles.globalColors.black : Styles.globalColors.black_20,
              },
              isElectron: {
                ...(props.description ? Styles.desktopStyles.editable : Styles.desktopStyles.clickable),
              },
            }),
          ])}
          onClick={props.canEditDescription ? props.onEditDescription : null}
          type={props.canEditDescription ? 'BodySecondaryLink' : 'Body'}
        >
          {props.description || (props.canEditDescription && 'Write a brief description')}
        </Kb.Text>
      ) : (
        <Kb.Box />
      )}

      {/* Actions */}
      <Kb.ButtonBar direction="row" style={styles.buttonBar}>
        {props.canChat && (
          <Kb.Button label="Chat" onClick={props.onChat}>
            <Kb.Icon
              type="iconfont-chat"
              style={Kb.iconCastPlatformStyles(styles.chatIcon)}
              color={Styles.globalColors.white}
            />
          </Kb.Button>
        )}
        {props.canManageMembers && (
          <Kb.Button
            type="Default"
            mode="Secondary"
            label="Add people"
            ref={Styles.isMobile ? undefined : props.setAttachmentRef}
            onClick={props.toggleShowingMenu}
          />
        )}
      </Kb.ButtonBar>

      {/* Add people how dropdown */}
      <AddPeopleHow
        attachTo={props.getAttachmentRef}
        visible={props.showingMenu}
        teamname={props.teamname}
        onHidden={props.toggleShowingMenu}
      />

      {/* CLI hint */}
      {!Styles.isMobile && (
        <Kb.InfoNote>
          <Kb.Text type="BodySmall">You can also manage teams from the terminal:</Kb.Text>
          <Kb.Text type="TerminalInline" selectable={true} style={styles.cliTerminalText}>
            keybase team --help
          </Kb.Text>
        </Kb.InfoNote>
      )}
    </Kb.Box>
  </Kb.Box>
)

const TeamHeader = Kb.OverlayParentHOC(_TeamHeader)

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

const styles = Styles.styleSheetCreate({
  addYourselfBanner: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: Styles.globalColors.blue,
    justifyContent: 'center',
    marginBottom: Styles.globalMargins.tiny,
    minHeight: 40,
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
    paddingTop: Styles.globalMargins.tiny,
  },
  addYourselfBannerText: {color: Styles.globalColors.white},
  buttonBar: Styles.platformStyles({
    isMobile: {
      marginBottom: -8,
      width: 'auto',
    },
  }),
  chatIcon: {
    marginRight: 8,
  },
  cliTerminalText: {
    marginLeft: Styles.globalMargins.xtiny,
    marginTop: Styles.globalMargins.xtiny,
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  description: {
    maxWidth: 560,
    paddingTop: Styles.globalMargins.tiny,
  },
  meta: {
    alignSelf: 'center',
    marginLeft: Styles.globalMargins.tiny,
  },
  teamHeader: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.tiny,
    },
    isElectron: {
      paddingTop: Styles.globalMargins.medium,
      textAlign: 'center',
    },
  }),
})

export {TeamHeader}
