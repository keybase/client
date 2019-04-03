// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {compose, connect} from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {teamsTab} from '../../../constants/tabs'

type Props = {|
  ...$Exact<Kb.OverlayParentProps>,
  isAdmin: boolean,
  isGeneralChannel: boolean,
  onAddPeople: () => void,
  onAddToChannel: () => void,
|}

const _AddPeople = (props: Props) => {
  let menu = null
  let directAction = null
  if (!props.isGeneralChannel) {
    // general channel & small teams don't need a menu
    const items = [
      {onClick: props.onAddPeople, title: 'To team'},
      {onClick: props.onAddToChannel, title: 'To channel'},
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
  }
  if (!props.isAdmin) {
    directAction = props.onAddToChannel
  }
  return (
    <Kb.Box2 direction="horizontal" centerChildren={true}>
      {menu}
      <Kb.Button
        type="Primary"
        onClick={directAction || props.toggleShowingMenu}
        ref={props.setAttachmentRef}
        small={true}
      >
        <Kb.Icon type="iconfont-new" color={Styles.globalColors.white} />
      </Kb.Button>
    </Kb.Box2>
  )
}
_AddPeople.displayName = 'AddPeople'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
  isAdmin: boolean,
  isGeneralChannel: boolean,
  teamname: ?string,
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
  Kb.OverlayParentHOC
)(_AddPeople)

export default AddPeople
