// @flow
import * as React from 'react'
import {Box2, Button, FloatingMenu, OverlayParentHOC, type OverlayParentProps} from '../../../common-adapters'
import {compose, connect} from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {teamsTab} from '../../../constants/tabs'

type Props = {|
  ...$Exact<OverlayParentProps>,
  isGeneralChannel: boolean,
  onAddPeople: () => void,
|}

const _AddPeople = (props: Props) => {
  let menu
  if (!props.isGeneralChannel) {
    // general channel & small teams don't need a menu
    const items = [{onClick: props.onAddPeople, title: 'To team'}, {disabled: true, title: 'To channel'}]
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
  isGeneralChannel: boolean,
  teamname: string,
}

const mapDispatchToProps = (dispatch, {teamname}: OwnProps) => {
  return {
    onAddPeople: () => {
      dispatch(
        RouteTreeGen.createNavigateTo({
          parentPath: [teamsTab],
          path: [{props: {teamname}, selected: 'team'}, {props: {teamname}, selected: 'addPeople'}],
        })
      )
      dispatch(RouteTreeGen.createSwitchTo({path: [teamsTab]}))
    },
  }
}

const AddPeople = compose(
  connect<OwnProps, _, _, _, _>(
    () => ({}),
    mapDispatchToProps,
    (s, d, o) => ({isGeneralChannel: o.isGeneralChannel, onAddPeople: d.onAddPeople})
  ),
  OverlayParentHOC
)(_AddPeople)

export default AddPeople
