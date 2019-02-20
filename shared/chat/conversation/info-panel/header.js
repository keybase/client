// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import InfoPanelMenu from './menu/container'

type SmallProps = {
  teamname: string,
  participantCount: number,
  isSmallTeam: boolean,
} & Kb.OverlayParentProps

const _SmallTeamHeader = (props: SmallProps) => {
  return (
    <Kb.Box style={styles.smallContainer}>
      <InfoPanelMenu
        attachTo={props.getAttachmentRef}
        onHidden={props.toggleShowingMenu}
        isSmallTeam={props.isSmallTeam}
        teamname={props.teamname}
        visible={props.showingMenu}
      />
      <Kb.ConnectedNameWithIcon
        containerStyle={styles.flexOne}
        horizontal={true}
        teamname={props.teamname}
        onClick="profile"
        title={props.teamname}
        metaOne={props.participantCount.toString() + ' member' + (props.participantCount !== 1 ? 's' : '')}
      />
      <Kb.Icon
        type="iconfont-gear"
        onClick={props.toggleShowingMenu}
        ref={props.setAttachmentRef}
        style={Kb.iconCastPlatformStyles(styles.gear)}
      />
    </Kb.Box>
  )
}
const SmallTeamHeader = Kb.OverlayParentHOC(_SmallTeamHeader)

// TODO probably factor this out into a connected component
type BigProps = {|
  canEditChannel: boolean,
  channelname: string,
  description: ?string,
  teamname: string,
  onEditChannel: () => void,
|}

type BigTeamHeaderProps = BigProps

const EditBox = Styles.isMobile
  ? Kb.ClickableBox
  : Styles.styled(Kb.ClickableBox)({
      '.header-row:hover &': {
        opacity: 1,
      },
      opacity: 0,
    })

const BigTeamHeader = (props: BigTeamHeaderProps) => {
  return (
    <Kb.Box2 direction={'vertical'} fullWidth={true} centerChildren={true} className="header-row">
      <Kb.Box style={styles.channelnameContainer}>
        <Kb.Text type="BodyBig">#{props.channelname}</Kb.Text>
        {props.canEditChannel && (
          <EditBox style={styles.editBox} onClick={props.onEditChannel}>
            <Kb.Icon
              style={Kb.iconCastPlatformStyles(styles.editIcon)}
              type="iconfont-edit"
              sizeType="Small"
            />
            <Kb.Text type="BodySmallPrimaryLink" className="hover-underline">
              Edit
            </Kb.Text>
          </EditBox>
        )}
      </Kb.Box>
      {!!props.description && <Kb.Markdown style={styles.description}>{props.description}</Kb.Markdown>}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  channelnameContainer: {
    alignSelf: 'center',
    marginBottom: 2,
    marginTop: Styles.globalMargins.medium,
    position: 'relative',
  },
  description: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    textAlign: 'center',
  },
  editBox: {
    ...Styles.globalStyles.flexBoxRow,
    position: 'absolute',
    right: -50,
    top: Styles.isMobile ? 2 : 1,
  },
  editIcon: {marginRight: Styles.globalMargins.xtiny},
  flexOne: {flex: 1},
  gear: Styles.platformStyles({
    common: {
      paddingLeft: 16,
      paddingRight: 16,
    },
    isMobile: {
      marginRight: 0,
      width: 56,
    },
  }),
  smallContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    marginLeft: Styles.globalMargins.small,
  },
})

export {SmallTeamHeader, BigTeamHeader}
