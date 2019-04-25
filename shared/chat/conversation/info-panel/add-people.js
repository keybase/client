// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Styles from '../../../styles'
import {Box2, Button, FloatingMenu, OverlayParentHOC, type OverlayParentProps} from '../../../common-adapters'
import {compose, connect} from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {teamsTab} from '../../../constants/tabs'

type Props = {|
  ...$Exact<OverlayParentProps>,
  isAdmin: boolean,
  isGeneralChannel: boolean,
  onAddPeople: () => void,
  onAddToChannel: () => void,
|}

const _AddPeople = (props: Props) => {
  let menu = null
  let directAction = null
  let directLabel = null
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
    <Box2 direction="horizontal" centerChildren={true}>
      {menu}
      <Button
        onClick={directAction || props.toggleShowingMenu}
        label={directLabel || 'Add someone...'}
        ref={props.setAttachmentRef}
        fullWidth={true}
        style={styles.addButton}
      />
    </Box2>
  )
}
_AddPeople.displayName = 'AddPeople'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
  isAdmin: boolean,
  isGeneralChannel: boolean,
  teamname: string,
}

const mapDispatchToProps = dispatch => {
  return {
    _onAddPeople: teamname => {
      dispatch(
        RouteTreeGen.createNavigateTo({
          parentPath: [teamsTab],
          path: [{props: {teamname}, selected: 'team'}, {props: {teamname}, selected: 'teamAddPeople'}],
        })
      )
      dispatch(RouteTreeGen.createSwitchTo({path: [teamsTab]}))
    },
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
  connect<OwnProps, _, _, _, _>(
    () => ({}),
    mapDispatchToProps,
    (s, d, o) => ({
      isAdmin: o.isAdmin,
      isGeneralChannel: o.isGeneralChannel,
      onAddPeople: () => d._onAddPeople(o.teamname),
      onAddToChannel: () => d._onAddToChannel(o.conversationIDKey),
    })
  ),
  OverlayParentHOC
)(_AddPeople)

const styles = Styles.styleSheetCreate({
  addButton: {marginLeft: Styles.globalMargins.small, marginRight: Styles.globalMargins.small},
})

export default AddPeople
