import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
import * as TeamTypes from '../../../constants/types/teams'
import * as TeamsGen from '../../../actions/teams-gen'
import * as Kb from '../../../common-adapters'
import {connect} from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

type Props = {
  isAdmin: boolean
  isGeneralChannel: boolean
  onAddPeople: () => void
  onAddToChannel: () => void
} & Kb.OverlayParentProps

const _AddPeople = (props: Props) => {
  let menu: React.ReactNode = null
  let directAction: null | (() => void) = null
  let directLabel: string | null = null
  if (!props.isGeneralChannel) {
    // general channel & small teams don't need a menu
    const items: Kb.MenuItems = [
      {icon: 'iconfont-people', onClick: props.onAddPeople, title: 'To team'},
      {icon: 'iconfont-hash', onClick: props.onAddToChannel, title: 'To channel'},
    ]
    menu = (
      <Kb.FloatingMenu
        attachTo={props.getAttachmentRef}
        visible={props.showingMenu}
        items={items}
        onHidden={props.toggleShowingMenu}
        position="bottom left"
        closeOnSelect={true}
      />
    )
  } else {
    directAction = props.onAddPeople
    directLabel = 'Add people to team'
  }
  if (!props.isAdmin) {
    directAction = props.onAddToChannel
    directLabel = 'Add members to channel'
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      {menu}
      <Kb.Button
        mode="Primary"
        type="Default"
        onClick={directAction || props.toggleShowingMenu}
        label={directLabel || 'Add people...'}
        ref={props.setAttachmentRef}
        style={styles.addButtonContainer}
      />
    </Kb.Box2>
  )
}
_AddPeople.displayName = 'AddPeople'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  isAdmin: boolean
  isGeneralChannel: boolean
}

const AddPeople = connect(
  (state, ownProps: OwnProps) => {
    const meta = Constants.getMeta(state, ownProps.conversationIDKey)
    return {teamID: meta.teamID}
  },
  dispatch => {
    return {
      _onAddPeople: (teamID: TeamTypes.TeamID) => dispatch(TeamsGen.createStartAddMembersWizard({teamID})),
      _onAddToChannel: (conversationIDKey: Types.ConversationIDKey, teamID: TeamTypes.TeamID) => {
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [{props: {conversationIDKey, teamID}, selected: 'chatAddToChannel'}],
          })
        )
      },
    }
  },
  (s, d, o: OwnProps) => ({
    isAdmin: o.isAdmin,
    isGeneralChannel: o.isGeneralChannel,
    onAddPeople: () => d._onAddPeople(s.teamID),
    onAddToChannel: () => d._onAddToChannel(o.conversationIDKey, s.teamID),
  })
)(Kb.OverlayParentHOC(_AddPeople))

const styles = Styles.styleSheetCreate(
  () =>
    ({
      addButtonContainer: {
        alignSelf: undefined,
        marginBottom: Styles.globalMargins.small,
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
      },
    } as const)
)

export default AddPeople
