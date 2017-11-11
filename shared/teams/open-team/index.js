// @flow
import React from 'react'
import {Box, Button, Input, Text, HeaderHoc} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'
import {withProps, mapProps, compose} from 'recompose'
import {isMobile} from '../../constants/platform'

type Role = 'reader' | 'writer'

const OpenTeamSettingButton = ({onClick, isOpen}: {onClick: () => void, isOpen: boolean}) =>
  isOpen
    ? <Text type="BodySmallSecondaryLink" onClick={onClick}>
        Close open access to this team
      </Text>
    : <Text type="BodySmallSecondaryLink" onClick={onClick}>
        Turn this into an open team
      </Text>

export type OpenTeamConfirmProps = {
  teamNameInput: string,
  onChangeTeamNameInput: (next: string) => void,
  confirmEnabled: boolean,
  defaultRole: Role,
  onChangeDefaultRole: () => void,
  onMakeTeamOpen: () => void,
  onClose: () => void,
}

const MakeOpenTeamConfirm = compose(
  mapProps(props => (isMobile ? {...props, onBack: props.onClose} : props)),
  withProps({title: 'Open this team to everyone?'}),
  HeaderHoc
)(
  ({
    teamNameInput,
    onChangeTeamNameInput,
    confirmEnabled,
    defaultRole,
    onChangeDefaultRole,
    onMakeTeamOpen,
  }: OpenTeamConfirmProps) => (
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
        <Input
          style={{flexShrink: 0}}
          value={teamNameInput}
          onChangeText={onChangeTeamNameInput}
          hintText="Team Name"
        />
      </Box>

      <Text type="BodyPrimaryLink" style={centerText} onClick={onChangeDefaultRole}>
        New users will join as {defaultRole}s
      </Text>

      <Box style={{...globalStyles.flexBoxColumn, flex: 1, alignItems: 'center', justifyContent: 'flex-end'}}>
        <Button
          type="Primary"
          style={{marginTop: globalMargins.medium}}
          label="Open this team"
          onClick={onMakeTeamOpen}
          disabled={!confirmEnabled}
        />
      </Box>
    </Box>
  )
)

type CloseTeamProps = {
  onMakeTeamClosed: () => void,
  onClose: () => void,
}

const MakeTeamClosed = compose(
  withProps({
    title: 'Close open access to this team?',
  }),
  mapProps(props => (isMobile ? {...props, onBack: props.onClose} : props)),
  HeaderHoc
)(({onMakeTeamClosed}: CloseTeamProps) => (
  <Box style={containerStyle}>
    <Text type="Body" style={{textAlign: 'center', flex: 1}}>
      This will prevent anyone from joining without an admin's confirmation
    </Text>
    <Button type="Primary" label="Close open access" onClick={onMakeTeamClosed} />
  </Box>
))

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

export {OpenTeamSettingButton, MakeOpenTeamConfirm, MakeTeamClosed}
