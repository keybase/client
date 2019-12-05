import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
import * as TeamTypes from '../../../constants/types/teams'
import {Box2, Button, FloatingMenu, OverlayParentHOC, OverlayParentProps} from '../../../common-adapters'
import {connect} from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {appendNewTeamBuilder} from '../../../actions/typed-routes'

type Props = {
  isAdmin: boolean
  isGeneralChannel: boolean
  onAddPeople: () => void
  onAddToChannel: () => void
} & OverlayParentProps

const _AddPeople = (props: Props) => {
  let menu: React.ReactNode = null
  let directAction: null | (() => void) = null
  let directLabel: string | null = null
  if (!props.isGeneralChannel) {
    // general channel & small teams don't need a menu
    const items = [
      {onClick: props.onAddPeople, title: 'To team'},
      {onClick: props.onAddToChannel, title: 'To channel'},
    ]
    menu = (
      <FloatingMenu
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
    <Box2 direction="vertical" fullWidth={true}>
      {menu}
      <Button
        mode="Primary"
        type="Default"
        onClick={directAction || props.toggleShowingMenu}
        label={directLabel || 'Add people...'}
        ref={props.setAttachmentRef}
        style={styles.addButtonContainer}
      />
    </Box2>
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
      _onAddPeople: (teamID: TeamTypes.TeamID) => dispatch(appendNewTeamBuilder(teamID)),
      _onAddToChannel: (conversationIDKey: Types.ConversationIDKey) => {
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [{props: {conversationIDKey}, selected: 'chatAddToChannel'}],
          })
        )
      },
    }
  },
  (s, d, o: OwnProps) => ({
    isAdmin: o.isAdmin,
    isGeneralChannel: o.isGeneralChannel,
    onAddPeople: () => d._onAddPeople(s.teamID),
    onAddToChannel: () => d._onAddToChannel(o.conversationIDKey),
  })
)(OverlayParentHOC(_AddPeople))

const styles = Styles.styleSheetCreate(
  () =>
    ({
      addButtonContainer: {
        marginBottom: Styles.globalMargins.small,
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
      },
    } as const)
)

export default AddPeople
