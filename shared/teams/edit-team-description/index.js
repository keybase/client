// @flow
import React from 'react'
import {Avatar, Box, Button, Input, MaybePopup, Text} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'
import {withProps, mapProps, compose} from 'recompose'
import {isMobile} from '../../constants/platform'

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
      <Text style={{paddingBottom: globalMargins.medium}} type='Header'>Edit team description</Text>
      <Avatar isTeam={true} teamname={teamname} size={40} />
      <Text style={{paddingBottom: globalMargins.medium, paddingTop: globalMargins.tiny}} type='Body'>{teamname}</Text>
      <Input
        hintText="Brief description"
        onChangeText={onChangeDescription}
        style={{flexShrink: 0}}
        value={description}
      />
      <Box style={{...globalStyles.flexBoxRow, flex: 1, alignItems: 'center', paddingTop: globalMargins.medium}}>
        <Button
          label="Cancel"
          onClick={onClose}
          type="Secondary"
        />
        <Button
          disabled={description === origDescription}
          label="Save"
          onClick={onSetDescription}
          style={{marginLeft: globalMargins.tiny}}
          type="Primary"
        />
      </Box>
    </Box>
  </MaybePopup>
)

const centerText = {
  textAlign: 'center',
}

export default EditTeamDescription
