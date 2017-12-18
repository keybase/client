// @flow
import React from 'react'
import {Avatar, Box, Button, Input, MaybePopup, Text, ButtonBar} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'

export type Props = {
  description: string,
  onChangeDescription: (description: string) => void,
  onSetDescription: ?(event: SyntheticEvent<>) => void,
  onClose: () => void,
  origDescription: string,
  teamname: string,
}

const EditTeamDescription = ({
  description,
  origDescription,
  teamname,
  onChangeDescription,
  onClose,
  onSetDescription,
}: Props) => (
  <MaybePopup onClose={onClose}>
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', padding: globalMargins.large}}>
      <Text style={{paddingBottom: globalMargins.medium}} type="Header">Edit team description</Text>
      <Avatar isTeam={true} teamname={teamname} size={40} />
      <Text style={{paddingBottom: globalMargins.medium, paddingTop: globalMargins.tiny}} type="Body">
        {teamname}
      </Text>
      <Input
        hintText="Brief description"
        onChangeText={onChangeDescription}
        style={{flexShrink: 0}}
        value={description}
      />
      <ButtonBar>
        <Button label="Cancel" onClick={onClose} type="Secondary" />
        <Button
          disabled={description === origDescription}
          label="Save"
          onClick={onSetDescription}
          type="Primary"
        />
      </ButtonBar>
    </Box>
  </MaybePopup>
)

export default EditTeamDescription
