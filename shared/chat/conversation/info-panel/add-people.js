// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import {Box2, Button, FloatingMenu, OverlayParentHOC, type OverlayParentProps} from '../../../common-adapters'
import {compose, connect} from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {teamsTab} from '../../../constants/tabs'

type Props = {|
  ...$Exact<OverlayParentProps>,
  isGeneralChannel: boolean,
  onAddPeople: () => void,
  onAddToChannel: () => void,
|}

const _AddPeople = (props: Props) => {
  let menu = null
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
  }
  return (
    <Box2 direction="horizontal" centerChildren={true}>
      {menu}
      <Button
        type="Primary"
        onClick={props.isGeneralChannel ? props.onAddPeople : props.toggleShowingMenu}
        label={props.isGeneralChannel ? 'Add to team' : 'Add someone...'}
        ref={props.setAttachmentRef}
      />
    </Box2>
  )
}

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
  isGeneralChannel: boolean,
  teamname: string,
}

const mapDispatchToProps = dispatch => {
  return {
    _onAddPeople: teamname => {
      dispatch(
        RouteTreeGen.createNavigateTo({
          parentPath: [teamsTab],
          path: [{props: {teamname}, selected: 'team'}, {props: {teamname}, selected: 'addPeople'}],
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
      isGeneralChannel: o.isGeneralChannel,
      onAddPeople: () => d._onAddPeople(o.teamname),
      onAddToChannel: () => d._onAddToChannel(o.conversationIDKey),
    })
  ),
  OverlayParentHOC
)(_AddPeople)

export default AddPeople
