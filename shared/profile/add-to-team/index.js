// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/teams'
import {ROLE_PICKER_ZINDEX} from '../../constants/profile'
import * as Types from '../../constants/types/teams'

type RowProps = {
  canAddThem: boolean,
  checked: boolean,
  disabledReason: string,
  name: Types.Teamname,
  isOpen: boolean,
  onCheck: () => void,
  them: string,
}

type Props = {
  addUserToTeamsResults: string,
  addUserToTeamsState: Types.AddUserToTeamsState,
  customComponent?: ?React.Node,
  headerStyle?: Styles.StylesCrossPlatform,
  loaded: {[string]: boolean},
  loadTeamList: () => void,
  onBack: () => void,
  onCancel?: () => void,
  onOpenRolePicker: (
    role: string,
    selectedRole: (Types.TeamRoleType) => void,
    selectedTeams: {[string]: boolean},
    styleCover?: Object
  ) => void,
  onRoleChange: string => void,
  onSave: (role: string, selectedTeams: {[string]: boolean}) => void,
  onToggle: string => void,
  role: Types.TeamRoleType,
  selectedTeams: {[string]: boolean},
  setSelectedTeams: ({[string]: boolean}) => void,
  teamProfileAddList: Array<Types.TeamProfileAddList>,
  teamnames: Array<Types.Teamname>,
  them: string,
  waiting: boolean,
}

const TeamRow = (props: RowProps) => (
  <Kb.ClickableBox onClick={props.canAddThem ? props.onCheck : null}>
    <Kb.Box2 direction="horizontal" style={styles.teamRow}>
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
            <Kb.Meta title="open" style={styles.meta} backgroundColor={Styles.globalColors.green} />
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

class AddToTeam extends React.Component<Props> {
  componentDidUpdate(prevProps: Props) {
    if (prevProps.addUserToTeamsState !== 'succeeded' && this.props.addUserToTeamsState === 'succeeded') {
      // If we succeeded, close the modal
      this.props.onBack()
    } else if (prevProps.addUserToTeamsState !== 'failed' && this.props.addUserToTeamsState === 'failed') {
      // If we failed, reload the team list -- some teams might have succeeded
      // and should be updated.
      this.props.loadTeamList()
    }
  }

  render() {
    const selectedTeamCount = Object.values(this.props.selectedTeams).filter(b => b).length
    return (
      <Kb.Box2 direction="vertical" style={styles.container}>
        {this.props.addUserToTeamsState === 'failed' && (
          <Kb.Box2
            direction="horizontal"
            fullWidth={true}
            noShrink={true}
            style={styles.addUserToTeamsResultsBox}
          >
            <Kb.Text style={styles.addUserToTeamsResultsText} type="BodySemibold" negative={true}>
              {this.props.addUserToTeamsResults}
            </Kb.Text>
          </Kb.Box2>
        )}
        {!Styles.isMobile && (
          <Kb.Box2 direction="horizontal" style={{paddingBottom: Styles.globalMargins.large}}>
            <Kb.Text type="Header">Add</Kb.Text>
            <Kb.Avatar
              isTeam={false}
              size={16}
              style={{marginLeft: Styles.globalMargins.tiny, marginRight: 2}}
              username={this.props.them}
            />
            <Kb.Text type="Header">{this.props.them} to...</Kb.Text>
          </Kb.Box2>
        )}

        <Kb.ScrollView style={{width: '100%'}}>
          <Kb.Box2 direction="vertical" style={{flexShrink: 1, width: '100%'}}>
            {!this.props.waiting ? (
              this.props.teamProfileAddList.length > 0 ? (
                this.props.teamProfileAddList.map(team => (
                  <TeamRow
                    canAddThem={!team.disabledReason}
                    checked={this.props.selectedTeams[team.teamName]}
                    disabledReason={team.disabledReason}
                    key={team.teamName}
                    name={team.teamName}
                    isOpen={team.open}
                    onCheck={() => this.props.onToggle(team.teamName)}
                    them={this.props.them}
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
        <Kb.Box2 direction={Styles.isMobile ? 'vertical' : 'horizontal'} style={styles.addToTeam}>
          <Kb.Text style={styles.addToTeamTitle} type="BodySmall">
            {this.props.them} will be added as a
          </Kb.Text>
          <Kb.DropdownButton
            toggleOpen={() =>
              this.props.onOpenRolePicker(
                this.props.role,
                selectedRole => this.props.onRoleChange(selectedRole),
                this.props.selectedTeams
              )
            }
            selected={DropdownItem(this.props.role)}
            style={{width: Styles.isMobile ? '100%' : 100}}
          />
        </Kb.Box2>
        <Kb.ButtonBar fullWidth={true} style={styles.buttonBar}>
          {!Styles.isMobile && <Kb.Button type="Secondary" onClick={this.props.onBack} label="Cancel" />}
          <Kb.WaitingButton
            disabled={selectedTeamCount === 0}
            fullWidth={Styles.isMobile}
            style={styles.addButton}
            type="Primary"
            onClick={() => this.props.onSave(this.props.role, this.props.selectedTeams)}
            label={selectedTeamCount <= 1 ? 'Add to team' : `Add to ${selectedTeamCount} teams`}
            waitingKey={Constants.addUserToTeamsWaitingKey(this.props.them)}
          />
        </Kb.ButtonBar>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  addButton: Styles.platformStyles({
    isMobile: {
      width: '100%',
    },
  }),
  addToTeam: Styles.platformStyles({
    common: {
      alignItems: 'center',
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.small,
    },
    isElectron: {
      marginTop: Styles.globalMargins.small,
    },
  }),
  addToTeamTitle: Styles.platformStyles({
    isElectron: {
      marginRight: Styles.globalMargins.tiny,
    },
    isMobile: {
      marginBottom: Styles.globalMargins.tiny,
      marginTop: Styles.globalMargins.tiny,
    },
  }),
  addUserToTeamsResultsBox: {
    backgroundColor: Styles.globalColors.red,
    marginBottom: Styles.globalMargins.small,
  },
  addUserToTeamsResultsText: {
    margin: Styles.globalMargins.tiny,
    textAlign: 'center',
    width: '100%',
  },
  buttonBar: Styles.platformStyles({
    isMobile: {
      paddingLeft: Styles.globalMargins.xsmall,
      paddingRight: Styles.globalMargins.xsmall,
    },
  }),
  container: Styles.platformStyles({
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
  }),
  divider: {
    marginLeft: 69,
  },
  meta: {
    alignSelf: 'center',
    marginLeft: Styles.globalMargins.xtiny,
    marginTop: 2,
  },
  teamRow: Styles.platformStyles({
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
  }),
})

const PopupWrapped = (props: Props) => (
  <Kb.PopupDialog styleCover={{zIndex: ROLE_PICKER_ZINDEX}} onClose={props.onBack}>
    <AddToTeam {...props} />
  </Kb.PopupDialog>
)
export default (Styles.isMobile ? AddToTeam : PopupWrapped)
