import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import InfoPanelMenu from './menu/container'
import * as ChatTypes from '../../../constants/types/chat2'
import AddPeople from './add-people'

type SmallProps = {
  admin: boolean
  teamname?: string
  channelname?: string
  conversationIDKey: ChatTypes.ConversationIDKey
  description?: string
  participantCount: number
  isPreview: boolean
  isSmallTeam: boolean
  onJoinChannel: () => void
} & Kb.OverlayParentProps

const gearIconSize = Styles.isMobile ? 24 : 16

const _TeamHeader = (props: SmallProps) => {
  let title = props.teamname
  if (props.channelname && !props.isSmallTeam) {
    title += '#' + props.channelname
  }
  const isGeneralChannel = props.channelname && props.channelname === 'general'
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
      <Kb.Box2 direction="horizontal" style={styles.smallContainer} fullWidth={true}>
        <InfoPanelMenu
          attachTo={props.getAttachmentRef}
          onHidden={props.toggleShowingMenu}
          isSmallTeam={props.isSmallTeam}
          teamname={props.teamname}
          conversationIDKey={props.conversationIDKey}
          visible={props.showingMenu}
        />
        <Kb.ConnectedNameWithIcon
          containerStyle={styles.flexOne}
          horizontal={true}
          teamname={props.teamname}
          onClick="profile"
          title={title}
          metaOne={props.participantCount.toString() + ' member' + (props.participantCount !== 1 ? 's' : '')}
        />
        <Kb.Icon
          type="iconfont-gear"
          onClick={props.toggleShowingMenu}
          ref={props.setAttachmentRef}
          style={Kb.iconCastPlatformStyles(styles.gear)}
          fontSize={gearIconSize}
        />
      </Kb.Box2>
      {!!props.description && (
        <Kb.Box2 direction="horizontal" style={styles.description}>
          <Kb.Markdown smallStandaloneEmoji={true} selectable={true}>
            {props.description}
          </Kb.Markdown>
        </Kb.Box2>
      )}
      {props.isPreview && (
        <Kb.Button
          mode="Primary"
          type="Default"
          label="Join channel"
          style={styles.addMembers}
          onClick={props.onJoinChannel}
        />
      )}
      {!props.isPreview && (props.admin || !isGeneralChannel) && (
        <AddPeople
          isAdmin={props.admin}
          isGeneralChannel={isGeneralChannel}
          teamname={props.teamname}
          conversationIDKey={props.conversationIDKey}
        />
      )}
    </Kb.Box2>
  )
}
const TeamHeader = Kb.OverlayParentHOC(_TeamHeader)

type AdhocProps = {
  onShowNewTeamDialog: () => void
  participants: ReadonlyArray<{
    username: string
    fullname: string
  }>
}

export const AdhocHeader = (props: AdhocProps) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
      <Kb.ScrollView style={styles.adhocScrollContainer}>
        {props.participants.map(p => {
          return (
            <Kb.NameWithIcon
              key={p.username}
              colorFollowing={true}
              containerStyle={styles.adhocPartContainer}
              horizontal={true}
              username={p.username}
              metaOne={p.fullname}
            />
          )
        })}
      </Kb.ScrollView>
      <Kb.Button
        mode="Primary"
        type="Default"
        label="Turn into a team"
        style={styles.addMembers}
        onClick={props.onShowNewTeamDialog}
      />
      <Kb.Text type="BodyTiny" center={true}>
        Add and delete members as you wish.
      </Kb.Text>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  addMembers: {
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
  },
  adhocPartContainer: {padding: Styles.globalMargins.tiny},
  adhocScrollContainer: Styles.platformStyles({
    isElectron: {maxHeight: 230},
    isMobile: {maxHeight: 220},
  }),
  channelnameContainer: {
    alignSelf: 'center',
    marginBottom: 2,
    marginTop: Styles.globalMargins.medium,
    position: 'relative',
  },
  description: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
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
      height: gearIconSize,
      paddingLeft: 16,
      paddingRight: 16,
      width: gearIconSize,
    },
    isMobile: {width: gearIconSize + 32},
  }),
  smallContainer: {
    alignItems: 'center',
    paddingLeft: Styles.globalMargins.small,
  },
})

export {TeamHeader}
