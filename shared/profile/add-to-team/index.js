// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {ROLE_PICKER_ZINDEX} from '../../constants/profile'
import type {RowProps, Props} from './index'

const TeamRow = (props: RowProps) => (
  <Kb.ClickableBox onClick={props.canAddThem ? props.onCheck : null}>
    <Kb.Box2 direction="horizontal" style={styleTeamRow}>
      <Kb.Checkbox disabled={!props.canAddThem} checked={props.checked} onCheck={props.onCheck} />
      <Kb.Box2 direction="vertical" style={{display: 'flex', position: 'relative'}}>
        <Kb.Avatar
          isTeam={true}
          size={Styles.isMobile ? 48 : 32}
          style={{marginRight: Styles.globalMargins.tiny}}
          teamname={props.name}
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical">
        <Kb.Box2 direction="horizontal" style={{alignSelf: 'flex-start'}}>
          <Kb.Text
            style={{color: props.canAddThem ? Styles.globalColors.black : Styles.globalColors.black_50}}
            type="BodySemibold"
          >
            {props.name}
          </Kb.Text>
          {props.isOpen && (
            <Kb.Meta title="open" style={styleMeta} backgroundColor={Styles.globalColors.green} />
          )}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" style={{alignSelf: 'flex-start'}}>
          <Kb.Text type="BodySmall">{props.disabledReason}</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
    {!Styles.isMobile && <Kb.Divider style={styles.divider} />}
  </Kb.ClickableBox>
)

const DropdownItem = (item: string) => (
  <Kb.Box2
    direction="horizontal"
    key={item}
    style={{
      alignItems: 'center',
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    }}
  >
    <Kb.Text type="BodySmallSemibold">{item}</Kb.Text>
  </Kb.Box2>
)

const AddToTeam = (props: Props) => {
  const selectedTeamCount = Object.values(props.selectedTeams).filter(b => b).length
  return (
    <Kb.Box2 direction="vertical" style={styleContainer}>
      {!!props.addUserToTeamsResults && (
        <Kb.Box2
          direction="horizontal"
          style={{
            backgroundColor: Styles.globalColors.green,
            minHeight: 40,
          }}
        >
          <Kb.Box2 direction="vertical" style={{flexGrow: 1}}>
            <Kb.Text
              center={true}
              style={{margin: Styles.globalMargins.tiny, width: '100%'}}
              type="BodySemibold"
              backgroundMode="HighRisk"
            >
              {this.props.addUserToTeamsResults}
            </Kb.Text>
          </Kb.Box2>
          <Kb.Box2 direction="vertical" style={{flexShrink: 1, justifyContent: 'center'}}>
            <Kb.Icon
              color={Styles.globalColors.black_50}
              onClick={this.props.onClearAddUserToTeamsResults}
              style={{padding: Styles.globalMargins.tiny}}
              type="iconfont-close"
            />
          </Kb.Box2>
        </Kb.Box2>
      )}
      {!Styles.isMobile && (
        <Kb.Box2 direction="horizontal" style={{paddingBottom: Styles.globalMargins.large}}>
          <Kb.Text type="Header">Add</Kb.Text>
          <Kb.Avatar
            isTeam={false}
            size={16}
            style={{marginLeft: Styles.globalMargins.tiny, marginRight: 2}}
            username={props.them}
          />
          <Kb.Text type="Header">{props.them} to...</Kb.Text>
        </Kb.Box2>
      )}

      <Kb.ScrollView style={{width: '100%'}}>
        <Kb.Box2 direction="vertical" style={{flexShrink: 1, width: '100%'}}>
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
              <Kb.Box2 direction="vertical" centerChildren={true}>
                <Kb.Text center={true} type="Body">
                  Looks like you haven't joined any teams yet yourself!
                </Kb.Text>
                <Kb.Text center={true} type="Body">
                  You can join teams over in the Teams tab.
                </Kb.Text>
              </Kb.Box2>
            )
          ) : (
            <Kb.Box2 direction="vertical" centerChildren={true}>
              <Kb.ProgressIndicator style={{width: 64}} />
            </Kb.Box2>
          )}
        </Kb.Box2>
      </Kb.ScrollView>
      <Kb.Box2 direction={isMobile ? 'vertical' : 'horizontal'} style={addToTeam}>
        <Kb.Text style={addToTeamTitle} type="BodySmall">
          {props.them} will be added as a
        </Kb.Text>
        <Kb.DropdownButton
          toggleOpen={() =>
            props.onOpenRolePicker(props.role, selectedRole => props.onRoleChange(selectedRole))
          }
          selected={DropdownItem(props.role)}
          style={{width: isMobile ? '100%' : 100}}
        />
      </Kb.Box2>
      <Kb.ButtonBar fullWidth={true} style={buttonBar}>
        {!isMobile && <Kb.Button type="Secondary" onClick={props.onBack} label="Cancel" />}
        <Kb.Button
          disabled={selectedTeamCount === 0}
          fullWidth={Styles.isMobile}
          style={addButton}
          type="Primary"
          onClick={() => props.onSave(props.role, props.selectedTeams)}
          label={selectedTeamCount <= 1 ? 'Add to team' : `Add to ${selectedTeamCount} teams`}
        />
      </Kb.ButtonBar>
    </Kb.Box2>
  )
}

const styleContainer = Styles.platformStyles({
  common: {
    alignItems: 'center',
    flex: 1,
    marginTop: 35,
  },
  isElectron: {
    marginBottom: Styles.globalMargins.tiny,
    width: 500,
  },
  isMobile: {
    marginBottom: Styles.globalMargins.xtiny,
    marginTop: 0,
    width: '100%',
  },
})

const styleMeta = {
  alignSelf: 'center',
  marginLeft: Styles.globalMargins.xtiny,
  marginTop: 2,
}

const styleTeamRow = Styles.platformStyles({
  common: {
    alignItems: 'center',
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
    width: '100%',
  },
  isElectron: {
    minHeight: 48,
    paddingLeft: Styles.globalMargins.tiny,
  },
  isMobile: {
    minHeight: 64,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.tiny,
  },
})

const addToTeam = Styles.latformStyles({
  common: {
    alignItems: 'center',
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
  },
  isElectron: {
    marginTop: Styles.globalMargins.small,
  },
})

const addToTeamTitle = Styles.platformStyles({
  isElectron: {
    marginRight: Styles.globalMargins.tiny,
  },
  isMobile: {
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.tiny,
  },
})

const buttonBar = Styles.platformStyles({
  isMobile: {
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
  },
})

const addButton = Styles.platformStyles({
  isMobile: {
    width: '100%',
  },
})

const styles = Styles.styleSheetCreate({
  divider: {
    marginLeft: 69,
  },
})

const PopupWrapped = (props: Props) => (
  <Kb.PopupDialog styleCover={{zIndex: ROLE_PICKER_ZINDEX}} onClose={props.onBack}>
    <AddToTeam {...props} />
  </Kb.PopupDialog>
)
export default (Styles.isMobile ? AddToTeam : PopupWrapped)
