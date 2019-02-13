// @flow
import * as React from 'react'
import {Box2, Button, OverlayParentHOC, type OverlayParentProps} from '../../../common-adapters'
import AddPeopleHow from '../../../teams/team/header/add-people-how/container'

const _AddPeople = (props: {teamname: string} & OverlayParentProps) => {
  return (
    <Box2 direction="horizontal" centerChildren={true}>
      <AddPeopleHow
        attachTo={props.getAttachmentRef}
        visible={props.showingMenu}
        teamname={props.teamname}
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
