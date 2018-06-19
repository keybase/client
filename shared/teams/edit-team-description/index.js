// @flow
import React from 'react'
import {Avatar, Box, Button, Input, MaybePopup, Text, ButtonBar, WaitingButton} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'

export type Props = {
  description: string,
  onChangeDescription: (description: string) => void,
  onSetDescription: ?(event: SyntheticEvent<>) => void,
  onClose: () => void,
  origDescription: string,
  teamname: string,
  waitingKey: string,
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
  <MaybePopup onClose={onClose}>
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
        <Button label="Cancel" onClick={onClose} type="Secondary" />
        <WaitingButton
          disabled={description === origDescription}
          label="Save"
          onClick={onSetDescription}
          type="Primary"
          waitingKey={waitingKey}
        />
      </ButtonBar>
    </Box>
  </MaybePopup>
)

export default EditTeamDescription
