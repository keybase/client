import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import TeamMenu from './menu-container'
import {TeamID} from '../../constants/types/teams'
import {pluralize} from '../../util/string'
import capitalize from 'lodash/capitalize'
import AddPeopleHow from './header/add-people-how/container'
import flags from '../../util/feature-flags'

const _AddPeopleButton = (
  props: {
    teamID: TeamID
  } & Kb.OverlayParentProps
) => (
  <>
    <Kb.Button
      label="Add/Invite people"
      onClick={props.toggleShowingMenu}
      ref={props.setAttachmentRef}
      type="Success"
      mode="Primary"
      fullWidth={true}
      style={styles.addPeopleButton}
    />
    <AddPeopleHow
      attachTo={props.getAttachmentRef}
      onHidden={props.toggleShowingMenu}
      teamID={props.teamID}
      visible={props.showingMenu}
    />
  </>
)
const AddPeopleButton = Kb.OverlayParentHOC(_AddPeopleButton)

type HeaderTitleProps = Kb.PropsWithOverlay<{
  active: boolean
  location?: string
  newMemberCount?: string
  onAddSelf?: () => void
  onChat: () => void
  onEdit: () => void
  onEditAvatar?: () => void
  onEditDescription?: () => void
  onManageInvites: () => void
  onRename?: () => void
  onShare: () => void
  teamID: TeamID
}>

const roleDisplay = {
  admin: 'an admin of',
  none: 'not a member of',
  owner: 'an owner of',
  reader: 'a reader in',
  writer: 'a writer in',
}

const _HeaderTitle = (props: HeaderTitleProps) => {
  const {teamID} = props
  const meta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const details = Container.useSelector(s => Constants.getTeamDetails(s, teamID))
  const yourOperations = Container.useSelector(s => Constants.getCanPerformByID(s, teamID))
  const loading = Container.useAnyWaiting(Constants.teamWaitingKey(meta.teamname))

  const avatar = (
    <Kb.Avatar
      editable={!!props.onEditAvatar}
      onEditAvatarClick={props.onEditAvatar}
      teamname={meta.teamname}
      size={96}
      style={Styles.collapseStyles([
        styles.alignSelfFlexStart,
        props.onEditAvatar && styles.marginBottomRightTiny, // space for edit icon
        props.onEditAvatar && styles.clickable,
      ])}
    />
  )

  const topDescriptors = (
    <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="xtiny" style={styles.flexShrink}>
      <Kb.Box2
        direction={Styles.isMobile ? 'vertical' : 'horizontal'}
        gap="xtiny"
        alignSelf="flex-start"
        style={styles.flexShrink}
      >
        <Kb.Box2
          direction="horizontal"
          alignItems="flex-end"
          gap="xtiny"
          alignSelf="flex-start"
          style={styles.flexShrink}
        >
          <Kb.Text type="Header" lineClamp={3} style={styles.header}>
            {meta.teamname}
          </Kb.Text>
          {!!props.onRename && <Kb.Icon type="iconfont-edit" onClick={props.onRename} />}
        </Kb.Box2>
        {meta.isOpen && (
          <Kb.Meta title="open" backgroundColor={Styles.globalColors.green} style={styles.openMeta} />
        )}
      </Kb.Box2>
      {!!meta.role && (
        <Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start">
          {(meta.role === 'admin' || meta.role === 'owner') && (
            <Kb.Icon
              color={meta.role === 'owner' ? Styles.globalColors.yellowDark : Styles.globalColors.black_35}
              fontSize={Styles.isMobile ? 16 : 10}
              type={meta.role === 'owner' ? 'iconfont-crown-owner' : 'iconfont-crown-admin'}
            />
          )}
          {(!Styles.isMobile || !!meta.role) && (
            <>
              <Kb.Text type="BodySmall">
                {Styles.isMobile
                  ? capitalize(meta.role)
                  : `You are ${roleDisplay[meta.role] || 'a member of'} this team. `}
              </Kb.Text>
              {meta.role === 'none' && (
                <Kb.Text type="BodySmallSecondaryLink" onClick={props.onAddSelf} style={styles.addSelfLink}>
                  Add yourself
                </Kb.Text>
              )}
            </>
          )}
        </Kb.Box2>
      )}
    </Kb.Box2>
  )

  const bottomDescriptorsAndButtons = (
    <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="tiny">
      {!!details.description && (
        <Kb.Text
          type="Body"
          lineClamp={3}
          onClick={props.onEditDescription}
          className={Styles.classNames({'hover-underline': !!props.onEditDescription})}
          style={styles.clickable}
        >
          {details.description}
        </Kb.Text>
      )}
      {meta.memberCount !== -1 && (
        <Kb.Text type="BodySmall">
          {meta.memberCount.toLocaleString()} {pluralize('member', meta.memberCount)}
          {!!props.newMemberCount && ` · ${props.newMemberCount} new this week`}
        </Kb.Text>
      )}
      {props.active && (
        <Kb.Box2 direction="horizontal" style={styles.alignSelfFlexStart} gap="xtiny">
          <Kb.Icon type="iconfont-fire" color={Styles.globalColors.green} fontSize={16} />
          <Kb.Text type="BodySmall" style={styles.greenText}>
            Active
          </Kb.Text>
        </Kb.Box2>
      )}
      <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center" style={styles.rightActionsContainer}>
        {meta.isMember && <Kb.Button label="Chat" onClick={props.onChat} small={true} />}
        {yourOperations.editTeamDescription && (
          <Kb.Button label="Edit" onClick={props.onEdit} small={true} mode="Secondary" />
        )}
        <Kb.Button label="Share" onClick={props.onShare} small={true} mode="Secondary" />
        <Kb.Button
          mode="Secondary"
          small={true}
          ref={props.setAttachmentRef}
          onClick={props.toggleShowingMenu}
        >
          <Kb.Icon type="iconfont-ellipsis" color={Styles.globalColors.blue} />
        </Kb.Button>
        <TeamMenu
          attachTo={props.getAttachmentRef}
          onHidden={props.toggleShowingMenu}
          teamID={props.teamID}
          visible={props.showingMenu}
        />
      </Kb.Box2>
    </Kb.Box2>
  )

  const addInviteAndLinkBox = (
    <Kb.Box2
      direction="vertical"
      gap={Styles.isMobile ? 'xtiny' : 'tiny'}
      style={styles.addInviteAndLinkBox}
      className="addInviteAndLinkBox"
      alignItems="center"
      alignSelf="flex-end"
    >
      <AddPeopleButton teamID={props.teamID} />
      {flags.teamInvites && (
        <Kb.Text type={Styles.isMobile ? 'BodyTiny' : 'BodySmall'}>
          {Styles.isMobile ? 'or' : 'or share a link:'}
        </Kb.Text>
      )}
      {flags.teamInvites &&
        (Styles.isMobile ? (
          <Kb.Button
            label="Generate invite link"
            onClick={props.onManageInvites}
            style={Styles.globalStyles.flexGrow}
            mode="Secondary"
            fullWidth={true}
          />
        ) : (
          <Kb.Box2 direction="vertical" gap="xtiny" alignItems="flex-start">
            <Kb.CopyText text="https://keybase.io/team/link/blahblah/" />
            <Kb.Text type="BodyTiny">Adds as writer • Expires 10,000 ys</Kb.Text>
            <Kb.Text type="BodyTiny" onClick={props.onManageInvites} className="hover-underline">
              Manage invite links
            </Kb.Text>
          </Kb.Box2>
        ))}
    </Kb.Box2>
  )

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  if (Styles.isMobile) {
    return (
      <Kb.Box2 alignItems="flex-start" direction="vertical" fullWidth={true} style={styles.backButton}>
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start">
          <Kb.BackButton onClick={onBack} />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="small" style={styles.outerBoxMobile}>
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
            {avatar}
            {topDescriptors}
          </Kb.Box2>
          {bottomDescriptorsAndButtons}
          {yourOperations.manageMembers && (
            <Kb.Box2 direction="horizontal" fullWidth={true}>
              {addInviteAndLinkBox}
            </Kb.Box2>
          )}
        </Kb.Box2>
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2
      alignItems="center"
      direction="horizontal"
      gap="small"
      gapStart={true}
      fullWidth={true}
      className="headerTitle"
    >
      {avatar}
      <Kb.Box2
        direction="vertical"
        alignItems="flex-start"
        alignSelf="flex-start"
        style={styles.flexShrinkGrow}
      >
        {topDescriptors}
        {bottomDescriptorsAndButtons}
      </Kb.Box2>
      {yourOperations.manageMembers && addInviteAndLinkBox}
    </Kb.Box2>
  )
}

export default Kb.OverlayParentHOC(_HeaderTitle)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      addInviteAndLinkBox: Styles.platformStyles({
        common: {
          borderColor: Styles.globalColors.black_10,
          borderStyle: 'solid',
          borderWidth: 1,
          flexShrink: 0,
          padding: Styles.globalMargins.tiny,
        },
        isElectron: {
          borderRadius: 4,
          height: 165,
          marginBottom: Styles.globalMargins.xsmall,
          marginRight: Styles.globalMargins.small,
          marginTop: Styles.globalMargins.tiny,
          width: 220,
        },
        isMobile: {
          borderRadius: 8,
          flexGrow: 1,
          margin: Styles.globalMargins.tiny,
        },
      }),
      addPeopleButton: {
        flexGrow: 0,
      },
      addSelfLink: {
        marginLeft: Styles.globalMargins.xtiny,
        textDecorationLine: 'underline',
      },
      alignSelfFlexStart: {
        alignSelf: 'flex-start',
      },
      backButton: {
        backgroundColor: Styles.globalColors.white,
        paddingTop: Styles.globalMargins.small,
      },
      banner: {
        ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xsmall, 0),
      },
      clickable: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.windowDraggingClickable,
        },
      }),
      flexShrink: {
        flexShrink: 1,
      },
      flexShrinkGrow: {
        flexGrow: 1,
        flexShrink: 1,
      },
      greenText: {
        color: Styles.globalColors.greenDark,
      },
      header: {
        flexShrink: 1,
      },
      marginBottomRightTiny: {
        marginBottom: Styles.globalMargins.tiny,
        marginRight: Styles.globalMargins.tiny,
      },
      openMeta: Styles.platformStyles({
        isElectron: {
          alignSelf: 'center',
          marginLeft: Styles.globalMargins.xtiny,
        },
        isMobile: {alignSelf: 'flex-start'},
      }),
      outerBoxMobile: {
        ...Styles.padding(Styles.globalMargins.small),
        backgroundColor: Styles.globalColors.white,
      },
      rightActionsContainer: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          paddingTop: Styles.globalMargins.tiny,
        },
        isElectron: Styles.desktopStyles.windowDraggingClickable,
      }),
    } as const)
)
