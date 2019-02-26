// @flow
import * as React from 'react'
import {Box2, Button, FloatingMenu, OverlayParentHOC, type OverlayParentProps} from '../../../common-adapters'
import {connect} from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {teamsTab} from '../../../constants/tabs'

type Props = {
  attachTo: () => ?React.Component<any>,
  showChannelOption: boolean,
  visible: boolean,
  onAddPeople: () => void,
  onHidden: () => void,
}

const AddPeopleHow = (props: Props) => {
  const items = [{onClick: props.onAddPeople, title: 'To team'}]
  if (props.showChannelOption) {
    items.push({disabled: true, title: 'To channel'})
  }

  return (
    <FloatingMenu
      attachTo={props.attachTo}
      visible={props.visible}
      items={items}
      onHidden={props.onHidden}
      position="bottom left"
      closeOnSelect={true}
    />
  )
}

type OwnProps = {
  attachTo: () => ?React.Component<any>,
  showChannelOption: boolean,
  onHidden: () => void,
  teamname: string,
  visible: boolean,
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

const ConnectedAddPeopleHow = connect<OwnProps, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(AddPeopleHow)

const _AddPeople = (props: {smallTeam: boolean, teamname: string} & OverlayParentProps) => {
  return (
    <Box2 direction="horizontal" centerChildren={true}>
      <ConnectedAddPeopleHow
        attachTo={props.getAttachmentRef}
        visible={props.showingMenu}
        teamname={props.teamname}
        showChannelOption={!props.smallTeam}
        onHidden={props.toggleShowingMenu}
      />
      <Button
        type="Primary"
        onClick={props.toggleShowingMenu}
        label="Add someone..."
        ref={props.setAttachmentRef}
      />
    </Box2>
  )
}
const AddPeople = OverlayParentHOC(_AddPeople)

export default AddPeople
