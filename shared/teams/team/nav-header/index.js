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

const styles = Styles.styleSheetCreate({
  clickable: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.windowDraggingClickable,
    },
  }),
  rightActionsContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.windowDraggingClickable,
      alignSelf: 'flex-end',
    },
  }),
})

type HeaderTitleProps = {
  teamname: string,
  description: string,
  members: number,
  onEditDescription: ?() => void,
  role: string,
}

export const HeaderTitle = (props: HeaderTitleProps) => (
  <Kb.Box2 alignItems="center" direction="horizontal" gap="small" gapStart={true}>
    <Kb.Avatar teamname={props.teamname} size={48} />
    <Kb.Box2 direction="vertical">
      <Kb.Text type="Header">{props.teamname}</Kb.Text>
      <Kb.Text type="BodySmall">
        TEAM · {props.members} {pluralize('member', props.members)}
        {!!props.role && ` · ${capitalize(props.role)}`}
      </Kb.Text>
      <Kb.Text
        type="BodySmall"
        lineClamp={1}
        onClick={props.onEditDescription}
        className={Styles.classNames({'hover-underline': !!props.onEditDescription})}
        style={styles.clickable}
      >
        {props.description}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)
