// @flow
import * as React from 'react'
import {capitalize} from 'lodash-es'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import AddPeopleHow from '../header/add-people-how/container'
import TeamMenu from '../menu-container'
import {pluralize} from '../../../util/string'

const _AddPeopleButton = (props: {teamname: string} & Kb.OverlayParentProps) => (
  <>
    <Kb.Button
      ref={props.setAttachmentRef}
      type="Secondary"
      label="Add people..."
      onClick={props.toggleShowingMenu}
    />
    <AddPeopleHow
      attachTo={props.getAttachmentRef}
      onHidden={props.toggleShowingMenu}
      teamname={props.teamname}
      visible={props.showingMenu}
    />
  </>
)
const AddPeopleButton = Kb.OverlayParentHOC(_AddPeopleButton)

type Props = {|
  ...$Exact<Kb.OverlayParentProps>,
  onOpenFolder: () => void,
  onChat: () => void,
  canAddPeople: boolean,
  canChat: boolean,
  canViewFolder: boolean,
  loading: boolean,
  teamname: string,
|}

const _HeaderRightActions = (props: Props) => (
  <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center" style={styles.rightActionsContainer}>
    {props.canChat && <Kb.Button onClick={props.onChat} type="Primary" label="Chat" />}
    {props.canAddPeople && <AddPeopleButton teamname={props.teamname} />}
    {!Styles.isMobile && props.canViewFolder && (
      <Kb.Icon onClick={props.onOpenFolder} type="iconfont-folder-private" />
    )}
    <Kb.Icon ref={props.setAttachmentRef} onClick={props.toggleShowingMenu} type="iconfont-ellipsis" />
    <TeamMenu
      attachTo={props.getAttachmentRef}
      onHidden={props.toggleShowingMenu}
      teamname={props.teamname}
      visible={props.showingMenu}
    />
  </Kb.Box2>
)
export const HeaderRightActions = Kb.OverlayParentHOC(_HeaderRightActions)

type HeaderTitleProps = {
  teamname: string,
  description: string,
  members: number,
  onEditAvatar: ?() => void,
  onEditDescription: ?() => void,
  role: string,
}

export const HeaderTitle = (props: HeaderTitleProps) => (
  <Kb.Box2 alignItems="center" direction="horizontal" gap="small" gapStart={true}>
    <Kb.Avatar
      editable={!!props.onEditAvatar}
      onEditAvatarClick={props.onEditAvatar}
      teamname={props.teamname}
      size={48}
      style={Styles.collapseStyles([
        props.onEditAvatar && styles.marginRightTiny, // space for edit icon
        props.onEditAvatar && styles.clickable,
      ])}
    />
    <Kb.Box2 direction="vertical">
      <Kb.Text type="Header">{props.teamname}</Kb.Text>
      <Kb.Text type="BodySmall">
        TEAM · {props.members} {pluralize('member', props.members)}
        {!!props.role && ` · ${props.role === 'none' ? 'Not a member' : capitalize(props.role)}`}
      </Kb.Text>
      <Kb.Text
        type={props.onEditDescription && !props.description ? 'BodySmallItalic' : 'BodySmall'}
        lineClamp={1}
        onClick={props.onEditDescription}
        className={Styles.classNames({'hover-underline': !!props.onEditDescription})}
        style={styles.clickable}
      >
        {props.description || (props.onEditDescription ? 'Write a brief description' : '')}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

type SubHeaderProps = {
  onAddSelf: ?() => void,
}

export const SubHeader = (props: SubHeaderProps) =>
  props.onAddSelf ? (
    <Kb.Box2 direction="horizontal" style={styles.banner} fullWidth={true}>
      <Kb.Banner
        color="blue"
        inline={true}
        text="You are not a member of this team."
        actions={[{onClick: props.onAddSelf, title: 'Add yourself'}]}
      />
    </Kb.Box2>
  ) : null

const styles = Styles.styleSheetCreate({
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
    },
  }),
})
