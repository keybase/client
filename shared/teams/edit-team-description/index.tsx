import React from 'react'
import {Avatar, Box, Button, Input, Text, ButtonBar, WaitingButton} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'

export type Props = {
  description: string
  onChangeDescription: (description: string) => void
  onSetDescription: () => void
  onClose: () => void
  origDescription: string
  teamname: string
  waitingKey: string
}

const EditTeamDescription = ({
  description,
  origDescription,
  teamname,
  onChangeDescription,
  onClose,
  onSetDescription,
  waitingKey,
}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', padding: globalMargins.large}}>
    <Avatar isTeam={true} teamname={teamname} size={64} />
    <Text style={{paddingBottom: globalMargins.medium, paddingTop: globalMargins.xtiny}} type="BodyBig">
      {teamname}
    </Text>
    <Input
      hintText="Brief description"
      onChangeText={onChangeDescription}
      value={description}
      multiline={true}
      style={{alignSelf: 'stretch', flexGrow: 1}}
    />
    <ButtonBar>
      <Button label="Cancel" onClick={onClose} type="Dim" />
      <WaitingButton
        disabled={description === origDescription}
        label="Save"
        onClick={onSetDescription}
        waitingKey={waitingKey}
      />
    </ButtonBar>
  </Box>
)

export default EditTeamDescription
