import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Styles from '../../../styles'
import {Box2, Button, FloatingMenu, OverlayParentHOC, OverlayParentProps} from '../../../common-adapters'
import {compose, connect} from '../../../util/container'
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
    directLabel = 'Add members to team'
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
        label={directLabel || 'Add someone...'}
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
  teamname: string
}

const mapDispatchToProps = dispatch => {
  return {
    _onAddPeople: teamname => dispatch(appendNewTeamBuilder(teamname)),
    _onAddToChannel: conversationIDKey => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey}, selected: 'chatAddToChannel'}],
        })
      )
    },
  }
}

const AddPeople = compose(
  connect(
    () => ({}),
    mapDispatchToProps,
    (_, d, o: OwnProps) => ({
      isAdmin: o.isAdmin,
      isGeneralChannel: o.isGeneralChannel,
      onAddPeople: () => d._onAddPeople(o.teamname),
      onAddToChannel: () => d._onAddToChannel(o.conversationIDKey),
    })
  ),
  OverlayParentHOC
)(_AddPeople) as any

const styles = Styles.styleSheetCreate({
  addButtonContainer: {marginLeft: Styles.globalMargins.small, marginRight: Styles.globalMargins.small},
})

export default AddPeople
