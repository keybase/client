// @flow
import React from 'react'
import {Box, Button, Dropdown, Input, Text, HeaderHoc} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'
import {withProps} from 'recompose'

type Role = 'reader' | 'writer'

const OpenTeamSettingButton = ({onClick, isOpen}: {onClick: () => void, isOpen: boolean}) =>
  isOpen
    ? <Text type="BodySmallSecondaryLink" onClick={onClick}>
        Close open access to this team
      </Text>
    : <Text type="BodySmallSecondaryLink" onClick={onClick}>
        Turn this into an open team
      </Text>

const roles: Array<Role> = ['reader', 'writer']
const rolePrettyName = {
  reader: 'KBFS Reader',
  writer: 'KBFS Reader and Writer',
}

const roleDescription = {
  reader: '(Recommended) They can only read from KBFS, but can read and write messages',
  writer: 'They can only read and write from KBFS, and can read and write messages',
}

const RoleDropDown = ({
  selectedRole,
  onChangeRole,
}: {
  selectedRole: Role,
  onChangeRole: (nextRole: Role) => void,
}) => {
  const roleNodes = roles.map(r => (
    <Text key={r} type="BodySmall">{rolePrettyName[r]} – {roleDescription[r]}</Text>
  ))
  return (
    <Dropdown
      onChanged={node => onChangeRole(roles[roleNodes.indexOf(node)])}
      selected={roleNodes[roles.indexOf(selectedRole)]}
      items={roleNodes}
    />
  )
}

export type OpenTeamConfirmProps = {
  teamNameInput: string,
  onChangeTeamNameInput: (next: string) => void,
  confirmEnabled: boolean,
  defaultRole: Role,
  onChangeDefaultRole: (nextRole: Role) => void,
  onMakeTeamOpen: () => void,
}

const MakeOpenTeamConfirm = withProps({title: 'Open this team to everyone?'})(
  HeaderHoc(
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

        <Text type="Body" style={centerText}>Select the default role for new team members</Text>
        <RoleDropDown selectedRole={defaultRole} onChangeRole={onChangeDefaultRole} />

        <Box
          style={{...globalStyles.flexBoxColumn, flex: 1, alignItems: 'center', justifyContent: 'flex-end'}}
        >
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
)

type CloseTeamProps = {
  onMakeTeamClosed: () => void,
}

const MakeTeamClosed = withProps({
  title: 'Close open access to this team?',
})(
  HeaderHoc(({onMakeTeamClosed}: CloseTeamProps) => (
    <Box style={containerStyle}>
      <Text type="Body" style={{textAlign: 'center', flex: 1}}>
        This will prevent anyone from joining without an admin's confirmation
      </Text>
      <Button type="Primary" label="Close open access" onClick={onMakeTeamClosed} />
    </Box>
  ))
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

export {OpenTeamSettingButton, MakeOpenTeamConfirm, MakeTeamClosed}
