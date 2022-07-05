import * as React from 'react'
import capitalize from 'lodash/capitalize'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import AddPeopleHow from '../header/add-people-how/container'
import TeamMenu from '../menu-container'
import {TeamID} from '../../../constants/types/teams'
import {pluralize} from '../../../util/string'

const AddPeopleButton = ({teamID}: {teamID: TeamID}) => {
  const {popup, showingPopup, toggleShowingPopup, popupAnchor} = Kb.usePopup(attachTo => (
    <AddPeopleHow attachTo={attachTo} onHidden={toggleShowingPopup} teamID={teamID} visible={showingPopup} />
  ))
  return (
    <>
      <Kb.Button
        label="Add members"
        onClick={toggleShowingPopup}
        ref={popupAnchor}
        small={true}
        type="Default"
        mode="Secondary"
      />
      {popup}
    </>
  )
}

type Props = {
  onChat: () => void
  canAddPeople: boolean
  canChat: boolean
  loading: boolean
  teamID: TeamID
  teamname: string
} & Kb.OverlayParentProps

const _HeaderRightActions = (props: Props) => (
  <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center" style={styles.rightActionsContainer}>
    {props.canChat && <Kb.Button label="Chat" onClick={props.onChat} small={true} />}
    {props.canAddPeople && <AddPeopleButton teamID={props.teamID} />}
    <Kb.Button mode="Secondary" small={true} ref={props.setAttachmentRef} onClick={props.toggleShowingMenu}>
      <Kb.Icon type="iconfont-ellipsis" color={Styles.globalColors.blue} />
    </Kb.Button>
    <TeamMenu
      attachTo={props.getAttachmentRef}
      onHidden={props.toggleShowingMenu}
      teamID={props.teamID}
      visible={props.showingMenu}
    />
  </Kb.Box2>
)
export const HeaderRightActions = Kb.OverlayParentHOC(_HeaderRightActions)

type HeaderTitleProps = {
  teamname: string
  description: string
  members: number
  onEditAvatar?: () => void
  onEditDescription?: () => void
  onRename?: () => void
  role: string
}

export const HeaderTitle = (props: HeaderTitleProps) => (
  <Kb.Box2 alignItems="center" direction="horizontal" gap="small" gapStart={true}>
    <Kb.Avatar
      editable={!!props.onEditAvatar}
      onEditAvatarClick={props.onEditAvatar}
      teamname={props.teamname}
      size={64}
      style={Styles.collapseStyles([
        props.onEditAvatar && styles.marginRightTiny, // space for edit icon
        props.onEditAvatar && styles.clickable,
      ])}
    />
    <Kb.Box2 direction="vertical">
      <Kb.Box2 direction="horizontal" alignItems="flex-end" gap="xtiny" style={styles.alignSelfFlexStart}>
        <Kb.Text type="Header" lineClamp={1}>
          {props.teamname}
        </Kb.Text>
        {!!props.onRename && <Kb.Icon type="iconfont-edit" onClick={props.onRename} />}
      </Kb.Box2>
      <Kb.Text
        type={props.onEditDescription && !props.description ? 'BodySmallItalic' : 'BodySmall'}
        lineClamp={3}
        onClick={props.onEditDescription}
        className={Styles.classNames({'hover-underline': !!props.onEditDescription})}
        style={styles.clickable}
      >
        {props.description || (props.onEditDescription ? 'Write a brief description' : '')}
      </Kb.Text>
      <Kb.Text type="BodySmall">
        {props.members} {pluralize('member', props.members)}
        {!!props.role && ` · ${props.role === 'none' ? 'Not a member' : capitalize(props.role)}`}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

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
      alignSelfFlexStart: {
        alignSelf: 'flex-start',
      },
      banner: {
        ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.xsmall, 0),
      },
      clickable: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.windowDraggingClickable,
        },
      }),
      marginRightTiny: {
        marginRight: Styles.globalMargins.tiny,
      },
      rightActionsContainer: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.windowDraggingClickable,
          alignSelf: 'flex-end',
          paddingRight: Styles.globalMargins.tiny,
        },
      }),
    } as const)
)
