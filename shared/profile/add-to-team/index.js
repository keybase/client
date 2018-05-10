// @flow
import * as React from 'react'
import {collapseStyles, globalColors, globalMargins, globalStyles, isMobile} from '../../styles'
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  ClickableBox,
  Dropdown,
  Divider,
  Meta,
  PopupDialog,
  ProgressIndicator,
  ScrollView,
  Text,
} from '../../common-adapters'
import {teamRoleTypes} from '../../constants/teams'
import {capitalize} from 'lodash-es'
import {type TeamRoleType} from '../../constants/types/teams'
import type {RowProps, Props} from './index'

const TeamRow = ({
  canAddThem,
  checked,
  name,
  isOpen,
  memberIsInTeam,
  onCheck,
  them,
  youCanAddPeople,
  waiting,
}: RowProps) => {
  const memberStatus = memberIsInTeam
    ? `${them} is already a member.`
    : youCanAddPeople ? '' : 'Only admins can add people.'
  return (
    <ClickableBox onClick={onCheck} style={globalStyles.flexBoxColumn}>
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          minHeight: isMobile ? 64 : 48,
          minWidth: isMobile ? undefined : 500,
          marginLeft: globalMargins.medium,
          marginRight: globalMargins.tiny,
          paddingTop: globalMargins.tiny,
          paddingBottom: globalMargins.tiny,
          alignItems: 'center',
        }}
      >
        <Checkbox disabled={!canAddThem} checked={checked} />
        <Box style={{display: 'flex', position: 'relative'}}>
          <Avatar
            isTeam={true}
            size={isMobile ? 48 : 32}
            style={{marginRight: globalMargins.tiny}}
            teamname={name}
          />
        </Box>
        {waiting ? (
          <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
            <ProgressIndicator style={{width: 16}} white={false} />
          </Box>
        ) : (
          <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
            <Box style={globalStyles.flexBoxRow}>
              <Text
                style={{color: canAddThem ? globalColors.black : globalColors.black_40}}
                type="BodySemibold"
              >
                {name}
              </Text>
              {isOpen && <Meta title="open" style={styleMeta} backgroundColor={globalColors.green} />}
            </Box>
            <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
              <Text type="BodySmall">{memberStatus}</Text>
            </Box>
          </Box>
        )}
        {!isMobile && <Divider style={{marginLeft: 48}} />}
      </Box>
    </ClickableBox>
  )
}

const _makeDropdownItem = (item: string) => (
  <Box
    key={item}
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      paddingLeft: globalMargins.small,
      paddingRight: globalMargins.small,
    }}
  >
    <Text type="Body">{capitalize(item)}</Text>
  </Box>
)

const _makeDropdownItems = () => teamRoleTypes.map(item => _makeDropdownItem(item))

const AddToTeam = (props: Props) => (
  <Box style={styleContainer}>
    <Box style={collapseStyles([globalStyles.flexBoxRow, {paddingBottom: globalMargins.large}])}>
      <Text type="Header">Add</Text>
      <Avatar isTeam={false} size={16} style={{marginLeft: globalMargins.tiny}} username={props.them} />
      <Text type="Header">{props.them} to...</Text>
    </Box>

    <ScrollView>
      <Box style={{flexShrink: 1, width: '100%'}}>
        {props.teamnames &&
          props.teamnames.map(name => {
            const youCanAddPeople =
              props.teamNameToCanPerform &&
              props.teamNameToCanPerform[name] &&
              props.teamNameToCanPerform[name].manageMembers
            const memberIsInTeam =
              props.teamNameToMembers &&
              props.teamNameToMembers[name] &&
              props.teamNameToMembers[name].get(props.them)
            const canAddThem = youCanAddPeople && !memberIsInTeam
            const waiting =
              !props.teamNameToMembers ||
              !props.teamNameToMembers[name] ||
              !props.teamNameToCanPerform ||
              !props.teamNameToCanPerform[name]
            return (
              <TeamRow
                canAddThem={canAddThem}
                checked={props.selectedTeams[name]}
                key={name}
                name={name}
                isOpen={props.teamNameToIsOpen[name]}
                memberIsInTeam={memberIsInTeam}
                onCheck={() => props.onToggle(name)}
                them={props.them}
                youCanAddPeople={youCanAddPeople}
                waiting={waiting}
              />
            )
          })}
      </Box>
    </ScrollView>
    <Box
      style={{
        ...(isMobile ? globalStyles.flexBoxColumn : globalStyles.flexBoxRow),
        alignItems: 'center',
        margin: isMobile ? 0 : globalMargins.small,
      }}
    >
      <Text style={{marginRight: globalMargins.tiny}} type="BodySmall">
        {props.them} will be added as a
      </Text>
      <ClickableBox
        onClick={() =>
          props.onOpenRolePicker(props.role, (selectedRole: TeamRoleType) => props.onRoleChange(selectedRole))
        }
        underlayColor="rgba(0, 0, 0, 0)"
      >
        <Dropdown
          items={_makeDropdownItems()}
          selected={_makeDropdownItem(props.role)}
          onChanged={(node: React.Node) => {
            // $FlowIssue doesn't understand key will be string
            const selectedRole: TeamRoleType = (node && node.key) || null
            props.onRoleChange(selectedRole)
          }}
        />
      </ClickableBox>
    </Box>
    <ClickableBox
      onClick={props.onBack}
      style={collapseStyles([globalStyles.flexBoxRow, {flexGrow: 1, paddingTop: globalMargins.small}])}
    >
      <Button style={{margin: globalMargins.small}} type="Secondary" onClick={props.onBack} label="Close" />
      <Button
        style={{margin: globalMargins.small}}
        type="Primary"
        onClick={() => props.onSave(props.role, props.selectedTeams)}
        label="Add to team"
      />
    </ClickableBox>
  </Box>
)

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  marginTop: 35,
  marginBottom: isMobile ? globalMargins.xtiny : globalMargins.medium,
  width: isMobile ? undefined : 500,
}

const styleMeta = {
  alignSelf: 'center',
  borderRadius: 1,
  marginLeft: globalMargins.xtiny,
  marginTop: 2,
}

const PopupWrapped = (props: Props) => (
  <PopupDialog styleCover={{zIndex: 20}} onClose={props.onBack}>
    <AddToTeam {...props} />
  </PopupDialog>
)
export default (isMobile ? AddToTeam : PopupWrapped)
