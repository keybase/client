// @flow
import * as React from 'react'
import {
  collapseStyles,
  globalColors,
  globalMargins,
  globalStyles,
  isMobile,
  platformStyles,
} from '../../styles'
import {
  Avatar,
  Box2,
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
import {ROLE_PICKER_ZINDEX} from '../../constants/profile'
import {type TeamRoleType} from '../../constants/types/teams'
import type {RowProps, Props} from './index'

const TeamRow = (props: RowProps) => {
  const memberStatus = props.memberIsInTeam
    ? `${props.them} is already a member.`
    : props.youCanAddPeople
      ? ''
      : 'Only admins can add people.'
  return (
    <ClickableBox onClick={props.onCheck}>
      <Box2 direction="horizontal" style={styleTeamRow}>
        <Checkbox disabled={!props.canAddThem} checked={props.checked} onCheck={props.onCheck} />
        <Box2 direction="vertical" style={{display: 'flex', position: 'relative'}}>
          <Avatar
            isTeam={true}
            size={isMobile ? 48 : 32}
            style={{marginRight: globalMargins.tiny}}
            teamname={props.name}
          />
        </Box2>
        {props.waiting ? (
          <Box2 direction="vertical">
            <ProgressIndicator style={{width: 16}} white={false} />
          </Box2>
        ) : (
          <Box2 direction="vertical">
            <Box2 direction="horizontal" style={{alignSelf: 'flex-start'}}>
              <Text
                style={{color: props.canAddThem ? globalColors.black : globalColors.black_40}}
                type="BodySemibold"
              >
                {props.name}
              </Text>
              {props.isOpen && <Meta title="open" style={styleMeta} backgroundColor={globalColors.green} />}
            </Box2>
            <Box2 direction="horizontal" style={{alignItems: 'center'}}>
              <Text type="BodySmall">{memberStatus}</Text>
            </Box2>
          </Box2>
        )}
        {!isMobile && <Divider style={{marginLeft: 48}} />}
      </Box2>
    </ClickableBox>
  )
}

const DropdownItem = ({item}: {item: string}) => (
  <Box2
    direction="horizontal"
    key={item}
    style={{
      alignItems: 'center',
      paddingLeft: globalMargins.small,
      paddingRight: globalMargins.small,
    }}
  >
    <Text type="Body">{capitalize(item)}</Text>
  </Box2>
)

const _makeDropdownItems = () => teamRoleTypes.map(item => <DropdownItem key={item} item={item} />)

const AddToTeam = (props: Props) => {
  console.warn(props)
  return (
    <Box2 direction="vertical" style={styleContainer}>
      {!isMobile && (
        <Box2 direction="horizontal" style={{paddingBottom: globalMargins.large}}>
          <Text type="Header">Add</Text>
          <Avatar
            isTeam={false}
            size={16}
            style={{marginLeft: globalMargins.tiny, marginRight: 2}}
            username={props.them}
          />
          <Text type="Header">{props.them} to...</Text>
        </Box2>
      )}

      <ScrollView>
        <Box2 direction="vertical" style={{flexShrink: 1, width: '100%'}}>
          {props.teamnames &&
            props.teamnames.map(team => {
              return (
                <TeamRow
                  canAddThem={props.canAddThem[team]}
                  checked={props.selectedTeams[team]}
                  key={team}
                  name={team}
                  isOpen={props.teamNameToIsOpen[team]}
                  memberIsInTeam={props.memberIsInTeam[team]}
                  onCheck={() => props.onToggle(team)}
                  them={props.them}
                  youCanAddPeople={props.youCanAddPeople[team]}
                  waiting={!props.loaded[team]}
                />
              )
            })}
        </Box2>
      </ScrollView>
      <Box2
        direction={isMobile ? 'vertical' : 'horizontal'}
        style={{
          alignItems: 'center',
          margin: isMobile ? 0 : globalMargins.small,
        }}
      >
        <Text style={{marginRight: globalMargins.tiny}} type="BodySmall">
          {props.them} will be added as a
        </Text>
        <ClickableBox
          onClick={() =>
            props.onOpenRolePicker(
              props.role,
              (selectedRole: TeamRoleType) => props.onRoleChange(selectedRole),
              {zIndex: ROLE_PICKER_ZINDEX}
            )
          }
          underlayColor="rgba(0, 0, 0, 0)"
        >
          <Dropdown
            items={_makeDropdownItems()}
            selected={<DropdownItem item={props.role} />}
            onChanged={(node: React.Node) => {
              // $FlowIssue doesn't understand key will be string
              const selectedRole: TeamRoleType = (node && node.key) || null
              props.onRoleChange(selectedRole)
            }}
          />
        </ClickableBox>
      </Box2>
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
    </Box2>
  )
}

const styleContainer = platformStyles({
  common: {
    alignItems: 'center',
    flex: 1,
    marginTop: 35,
  },
  isElectron: {
    marginBottom: globalMargins.medium,
    width: 500,
  },
  isMobile: {
    marginBottom: globalMargins.xtiny,
  },
})

const styleMeta = {
  alignSelf: 'center',
  borderRadius: 1,
  marginLeft: globalMargins.xtiny,
  marginTop: 2,
}

const styleTeamRow = platformStyles({
  common: {
    alignItems: 'center',
    marginLeft: globalMargins.medium,
    marginRight: globalMargins.tiny,
    paddingBottom: globalMargins.tiny,
    paddingTop: globalMargins.tiny,
  },
  isMobile: {
    minHeight: 64,
    minWidth: '100%',
  },
  isElectron: {
    minHeight: 48,
    minWidth: 500,
  },
})

const PopupWrapped = (props: Props) => (
  <PopupDialog styleCover={{zIndex: ROLE_PICKER_ZINDEX}} onClose={props.onBack}>
    <AddToTeam {...props} />
  </PopupDialog>
)
export default (isMobile ? AddToTeam : PopupWrapped)
