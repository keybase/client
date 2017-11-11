// @flow
import React from 'react'
import {Box, Button, Input, Text, HeaderHoc} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'
import {withProps, mapProps, compose} from 'recompose'
import {isMobile} from '../../constants/platform'

export type Props = {
  description: string,
  teamname: string,
  onChangeDescription: (description: string) => void,
  onSetDescription: (description: string) => void,
  onClose: () => void,
}

const EditTeamDescription = compose(
  mapProps(props => (isMobile ? {...props, onBack: props.onClose} : props)),
  withProps({title: 'Edit team description'}),
  HeaderHoc
)(
  ({
    description,
    teamname,
    onChangeDescription,
    onSetDescription,
  }: Props) => (
    <Box style={containerStyle}>
      <Text type="Body" style={centerText}>
        This will allow anyone to join without an admin's confirmation.
      </Text>

      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          marginTop: globalMargins.medium,
          marginBottom: globalMargins.medium,
        }}
      >
        <Text type="Body" style={centerText}>
          Type the team name to confirm
        </Text>
      </Box>

      <Box style={{...globalStyles.flexBoxColumn, flex: 1, alignItems: 'center', justifyContent: 'flex-end'}}>
        <Button
          type="Primary"
          style={{marginTop: globalMargins.medium}}
          label="Save"
          onClick={onSetDescription}
        />
      </Box>
    </Box>
  )
)

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  paddingBottom: globalMargins.medium,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}

const centerText = {
  textAlign: 'center',
}

export default EditTeamDescription
export type {Props}
