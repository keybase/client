// @flow
import * as React from 'react'
import {globalColors, globalMargins, isMobile, platformStyles, styleSheetCreate} from '../../styles'
import {
  Avatar,
  Box2,
  Button,
  ButtonBar,
  Checkbox,
  ClickableBox,
  DropdownButton,
  Divider,
  Meta,
  PopupDialog,
  ProgressIndicator,
  ScrollView,
  Text,
} from '../../common-adapters'
import {ROLE_PICKER_ZINDEX} from '../../constants/profile'
import type {RowProps, Props} from './index'

const TeamRow = (props: RowProps) => (
  <ClickableBox onClick={props.canAddThem ? props.onCheck : null}>
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
      <Box2 direction="vertical">
        <Box2 direction="horizontal" style={{alignSelf: 'flex-start'}}>
          <Text
            style={{color: props.canAddThem ? globalColors.black_75 : globalColors.black_50}}
            type="BodySemibold"
          >
            {props.name}
          </Text>
          {props.isOpen && <Meta title="open" style={styleMeta} backgroundColor={globalColors.green} />}
        </Box2>
        <Box2 direction="horizontal" style={{alignSelf: 'flex-start'}}>
          <Text type="BodySmall">{props.disabledReason}</Text>
        </Box2>
      </Box2>
    </Box2>
    {!isMobile && <Divider style={styles.divider} />}
  </ClickableBox>
)

const DropdownItem = (item: string) => (
  <Box2
    direction="horizontal"
    key={item}
    style={{
      alignItems: 'center',
      paddingLeft: globalMargins.small,
      paddingRight: globalMargins.small,
    }}
  >
    <Text type="BodySmallSemibold">{item}</Text>
  </Box2>
)

const AddToTeam = (props: Props) => {
  const selectedTeamCount = Object.values(props.selectedTeams).filter(b => b).length
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

      <ScrollView style={{width: '100%'}}>
        <Box2 direction="vertical" style={{flexShrink: 1, width: '100%'}}>
          {!props.waiting ? (
            props.teamProfileAddList.length > 0 ? (
              props.teamProfileAddList.map(team => (
                <TeamRow
                  canAddThem={!team.disabledReason}
                  checked={props.selectedTeams[team.teamName]}
                  disabledReason={team.disabledReason}
                  key={team.teamName}
                  name={team.teamName}
                  isOpen={team.open}
                  onCheck={() => props.onToggle(team.teamName)}
                  them={props.them}
                />
              ))
            ) : (
              <Box2 direction="vertical" centerChildren={true}>
                <Text center={true} type="Body">
                  Looks like you haven't joined any teams yet yourself!
                </Text>
                <Text center={true} type="Body">
                  You can join teams over in the Teams tab.
                </Text>
              </Box2>
            )
          ) : (
            <Box2 direction="vertical" centerChildren={true}>
              <ProgressIndicator style={{width: 64}} />
            </Box2>
          )}
        </Box2>
      </ScrollView>
      <Box2 direction={isMobile ? 'vertical' : 'horizontal'} style={addToTeam}>
        <Text style={addToTeamTitle} type="BodySmall">
          {props.them} will be added as a
        </Text>
        <DropdownButton
          toggleOpen={() =>
            props.onOpenRolePicker(props.role, selectedRole => props.onRoleChange(selectedRole))
          }
          selected={DropdownItem(props.role)}
          style={{width: isMobile ? '100%' : 100}}
        />
      </Box2>
      <ButtonBar fullWidth={true} style={buttonBar}>
        {!isMobile && <Button type="Secondary" onClick={props.onBack} label="Cancel" />}
        <Button
          disabled={selectedTeamCount === 0}
          fullWidth={isMobile}
          style={addButton}
          type="Primary"
          onClick={() => props.onSave(props.role, props.selectedTeams)}
          label={selectedTeamCount <= 1 ? 'Add to team' : `Add to ${selectedTeamCount} teams`}
        />
      </ButtonBar>
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
    marginBottom: globalMargins.tiny,
    width: 500,
  },
  isMobile: {
    marginBottom: globalMargins.xtiny,
    marginTop: 0,
    width: '100%',
  },
})

const styleMeta = {
  alignSelf: 'center',
  marginLeft: globalMargins.xtiny,
  marginTop: 2,
}

const styleTeamRow = platformStyles({
  common: {
    alignItems: 'center',
    paddingBottom: globalMargins.tiny,
    paddingTop: globalMargins.tiny,
    width: '100%',
  },
  isElectron: {
    minHeight: 48,
    paddingLeft: globalMargins.tiny,
  },
  isMobile: {
    minHeight: 64,
    paddingLeft: globalMargins.xsmall,
    paddingRight: globalMargins.tiny,
  },
})

const addToTeam = platformStyles({
  common: {
    alignItems: 'center',
    marginLeft: globalMargins.small,
    marginRight: globalMargins.small,
  },
  isElectron: {
    marginTop: globalMargins.small,
  },
})

const addToTeamTitle = platformStyles({
  isElectron: {
    marginRight: globalMargins.tiny,
  },
  isMobile: {
    marginBottom: globalMargins.tiny,
    marginTop: globalMargins.tiny,
  },
})

const buttonBar = platformStyles({
  isMobile: {
    paddingLeft: globalMargins.xsmall,
    paddingRight: globalMargins.xsmall,
  },
})

const addButton = platformStyles({
  isMobile: {
    width: '100%',
  },
})

const styles = styleSheetCreate({
  divider: {
    marginLeft: 69,
  },
})

const PopupWrapped = (props: Props) => (
  <PopupDialog styleCover={{zIndex: ROLE_PICKER_ZINDEX}} onClose={props.onBack}>
    <AddToTeam {...props} />
  </PopupDialog>
)
export default (isMobile ? AddToTeam : PopupWrapped)
