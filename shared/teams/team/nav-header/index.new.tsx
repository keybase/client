import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import TeamMenu from '../menu-container'
import {TeamID} from '../../../constants/types/teams'
import {pluralize} from '../../../util/string'
import capitalize from 'lodash/capitalize'

// TODO: delete this component when we implement the invite widget
// const _AddPeopleButton = (
//   props: {
//     teamID: TeamID
//   } & Kb.OverlayParentProps
// ) => (
//   <>
//     <Kb.Button
//       label="Add members"
//       onClick={props.toggleShowingMenu}
//       ref={props.setAttachmentRef}
//       small={true}
//       type="Default"
//       mode="Secondary"
//     />
//     <AddPeopleHow
//       attachTo={props.getAttachmentRef}
//       onHidden={props.toggleShowingMenu}
//       teamID={props.teamID}
//       visible={props.showingMenu}
//     />
//   </>
// )
// const AddPeopleButton = Kb.OverlayParentHOC(_AddPeopleButton)

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
    <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="xtiny">
      <Kb.Box2 direction={Styles.isMobile ? 'vertical' : 'horizontal'} gap="xtiny" alignSelf="flex-start">
        <Kb.Box2 direction="horizontal" alignItems="flex-end" gap="xtiny" alignSelf="flex-start">
          <Kb.Text type="Header" lineClamp={1}>
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
        {/* {props.canAddPeople && <AddPeopleButton teamID={props.teamID} />} */}
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
      </Kb.Box2>
    </Kb.Box2>
  ) : (
    <Kb.Box2 alignItems="center" direction="horizontal" gap="small" gapStart={true}>
      {avatar}
      <Kb.Box2 direction="vertical" alignItems="flex-start">
        {topDescriptors}
        {bottomDescriptorsAndButtons}
      </Kb.Box2>
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
      addSelfLink: {marginLeft: Styles.globalMargins.xtiny},
      alignSelfFlexStart: {
        alignSelf: 'flex-start',
      },
      backButton: {
        backgroundColor: Styles.globalColors.white,
        marginTop: Styles.globalMargins.xtiny,
      },
      banner: {
        ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.xsmall, 0),
      },
      clickable: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.windowDraggingClickable,
        },
      }),
      greenText: {
        color: Styles.globalColors.greenDark,
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
