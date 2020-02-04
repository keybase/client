import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import TeamMenu from '../menu-container'
import {TeamID} from '../../../constants/types/teams'
import {pluralize} from '../../../util/string'
import capitalize from 'lodash/capitalize'
import AddPeopleHow from '../header/add-people-how/container'
import flags from '../../../util/feature-flags'
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

type HeaderTitleProps = {
  active: boolean
  canAddPeople: boolean
  canChat: boolean
  canEdit: boolean
  description: string
  isOpen: boolean
  loading: boolean
  location?: string
  members: number
  newMemberCount?: string
  onAddSelf?: () => void
  onChat: () => void
  onEdit: () => void
  onEditAvatar?: () => void
  onEditDescription?: () => void
  onManageInvites: () => void
  onRename?: () => void
  onShare: () => void
  role: string
  teamID: TeamID
  teamname: string
} & Kb.OverlayParentProps

const roleDisplay = {
  admin: 'an admin of',
  none: 'not a member of',
  owner: 'an owner of',
  reader: 'a reader in',
  writer: 'a writer in',
}

const _HeaderTitle = (props: HeaderTitleProps) => {
  const avatar = (
    <Kb.Avatar
      editable={!!props.onEditAvatar}
      onEditAvatarClick={props.onEditAvatar}
      teamname={props.teamname}
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
            {props.teamname}
          </Kb.Text>
          {!!props.onRename && <Kb.Icon type="iconfont-edit" onClick={props.onRename} />}
        </Kb.Box2>
        {props.isOpen && (
          <Kb.Meta title="open" backgroundColor={Styles.globalColors.green} style={styles.openMeta} />
        )}
      </Kb.Box2>
      {!!props.role && (
        <Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start">
          {(props.role === 'admin' || props.role === 'owner') && (
            <Kb.Icon
              color={props.role === 'owner' ? Styles.globalColors.yellowDark : Styles.globalColors.black_35}
              fontSize={Styles.isMobile ? 16 : 10}
              type={props.role === 'owner' ? 'iconfont-crown-owner' : 'iconfont-crown-admin'}
            />
          )}
          {(!Styles.isMobile || !!props.role) && (
            <>
              <Kb.Text type="BodySmall">
                {Styles.isMobile
                  ? capitalize(props.role)
                  : `You are ${roleDisplay[props.role] || 'a member of'} this team. `}
              </Kb.Text>
              {props.role === 'none' && (
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
      {!!props.description && (
        <Kb.Text
          type="Body"
          lineClamp={3}
          onClick={props.onEditDescription}
          className={Styles.classNames({'hover-underline': !!props.onEditDescription})}
          style={styles.clickable}
        >
          {props.description}
        </Kb.Text>
      )}
      {props.members !== -1 && (
        <Kb.Text type="BodySmall">
          {props.members.toLocaleString()} {pluralize('member', props.members)}
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
        {props.canChat && <Kb.Button label="Chat" onClick={props.onChat} small={true} />}
        {props.canEdit && <Kb.Button label="Edit" onClick={props.onEdit} small={true} mode="Secondary" />}
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
      gap="tiny"
      style={styles.addInviteAndLinkBox}
      alignItems="center"
      alignSelf="flex-end"
    >
      <AddPeopleButton teamID={props.teamID} />
      {flags.teamInvites && <Kb.Text type="BodySmall">or share a link:</Kb.Text>}
      {flags.teamInvites && (
        <Kb.Box2 direction="vertical" gap="xtiny" alignItems="flex-start">
          <Kb.CopyText text="https://keybase.io/team/link/blahblah/" />
          <Kb.Text type="BodyTiny">Adds as writer • Expires 10,000 ys</Kb.Text>
          <Kb.Text type="BodyTiny" onClick={props.onManageInvites} className="hover-underline">
            Manage invite links
          </Kb.Text>
        </Kb.Box2>
      )}
    </Kb.Box2>
  )

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  return Styles.isMobile ? (
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
        {props.canAddPeople && addInviteAndLinkBox}
      </Kb.Box2>
    </Kb.Box2>
  ) : (
    <Kb.Box2 alignItems="center" direction="horizontal" gap="small" gapStart={true} fullWidth={true}>
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
      {props.canAddPeople && addInviteAndLinkBox}
    </Kb.Box2>
  )
}

export default Kb.OverlayParentHOC(_HeaderTitle)

type SubHeaderProps = {
  onAddSelf: (() => void) | null
}

export const SubHeader = (props: SubHeaderProps) =>
  props.onAddSelf ? (
    <Kb.Box2 direction="horizontal" style={styles.banner} fullWidth={true}>
      <Kb.Banner color="blue" inline={true}>
        <Kb.BannerParagraph
          bannerColor="red"
          content={[
            'You are not a member of this team. ',
            {onClick: props.onAddSelf, text: 'Add yourself'},
            '?',
          ]}
        />
      </Kb.Banner>
    </Kb.Box2>
  ) : null

const styles = Styles.styleSheetCreate(
  () =>
    ({
      addInviteAndLinkBox: Styles.platformStyles({
        common: {
          borderRadius: 4,
          flexShrink: 0,
          height: 165,
          marginBottom: Styles.globalMargins.xsmall,
          marginRight: Styles.globalMargins.small,
          marginTop: Styles.globalMargins.tiny,
          padding: Styles.globalMargins.tiny,
          width: 220,
        },
        isElectron: {
          boxShadow: `0 2px 10px 0 ${Styles.globalColors.black_20}`,
        },
        isMobile: {
          shadowColor: Styles.globalColors.black_20,
          shadowOffset: {height: 0, width: 2},
          shadowOpacity: 1,
          shadowRadius: 5,
        },
      }),
      addSelfLink: {
        marginLeft: Styles.globalMargins.xtiny,
        textDecorationLine: 'underline',
      },
      alignSelfFlexStart: {
        alignSelf: 'flex-start',
      },
      backButton: {
        backgroundColor: Styles.globalColors.white,
        marginTop: Styles.globalMargins.xtiny,
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
