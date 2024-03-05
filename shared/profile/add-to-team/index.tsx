import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import {FloatingRolePicker} from '@/teams/role-picker'
import {InlineDropdown} from '@/common-adapters/dropdown'

type RowProps = {
  canAddThem: boolean
  checked: boolean
  disabledReason: string
  name: T.Teams.Teamname
  isOpen: boolean
  onCheck: (selected: boolean) => void
  them: string
}

type RolePickerProps = {
  footerComponent: React.ReactNode
  isRolePickerOpen: boolean
  onCancelRolePicker: () => void
  onConfirmRolePicker: (role: T.Teams.TeamRoleType) => void
  onOpenRolePicker: () => void
  selectedRole: T.Teams.TeamRoleType
  disabledReasonsForRolePicker: {[K in T.Teams.TeamRoleType]?: string}
}

// This state is handled by the state wrapper in the container
export type ComponentState = {
  selectedTeams: Set<string>
  onSave: () => void
  onToggle: (teamName: string, selected: boolean) => void
}

export type AddToTeamProps = {
  title: string
  addUserToTeamsResults: string
  addUserToTeamsState: T.Teams.AddUserToTeamsState
  loadTeamList: () => void
  onBack: () => void
  teamProfileAddList: ReadonlyArray<T.Teams.TeamProfileAddList>
  them: string
  waiting: boolean
}

type Props = {} & AddToTeamProps & RolePickerProps & ComponentState

const TeamRow = (props: RowProps) => (
  <Kb.ClickableBox onClick={props.canAddThem ? () => props.onCheck(!props.checked) : undefined}>
    <Kb.Box2 direction="horizontal" style={styles.teamRow}>
      <Kb.Checkbox disabled={!props.canAddThem} checked={props.checked} onCheck={props.onCheck} />
      <Kb.Box2 direction="vertical" style={{display: 'flex', position: 'relative'}}>
        <Kb.Avatar
          isTeam={true}
          size={Kb.Styles.isMobile ? 48 : 32}
          style={{marginRight: Kb.Styles.globalMargins.tiny}}
          teamname={props.name}
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical">
        <Kb.Box2 direction="horizontal" style={{alignSelf: 'flex-start'}}>
          <Kb.Text
            style={{color: props.canAddThem ? Kb.Styles.globalColors.black : Kb.Styles.globalColors.black_50}}
            type="BodySemibold"
          >
            {props.name}
          </Kb.Text>
          {props.isOpen && (
            <Kb.Meta title="open" style={styles.meta} backgroundColor={Kb.Styles.globalColors.green} />
          )}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" style={{alignSelf: 'flex-start'}}>
          <Kb.Text type="BodySmall">{props.disabledReason}</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
    {!Kb.Styles.isMobile && <Kb.Divider style={styles.divider} />}
  </Kb.ClickableBox>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      addButton: Kb.Styles.platformStyles({
        isMobile: {width: '100%'},
      }),
      addToTeam: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          flexShrink: 0,
          flexWrap: 'wrap',
          marginBottom: Kb.Styles.globalMargins.small,
          marginLeft: Kb.Styles.globalMargins.small,
          marginRight: Kb.Styles.globalMargins.small,
        },
        isElectron: {marginTop: Kb.Styles.globalMargins.small},
      }),
      addToTeamTitle: Kb.Styles.platformStyles({
        common: {marginRight: Kb.Styles.globalMargins.tiny},
        isMobile: {
          marginBottom: Kb.Styles.globalMargins.tiny,
          marginTop: Kb.Styles.globalMargins.tiny,
        },
      }),
      addUserToTeamsResultsBox: {
        backgroundColor: Kb.Styles.globalColors.red,
        marginBottom: Kb.Styles.globalMargins.small,
      },
      addUserToTeamsResultsText: {
        margin: Kb.Styles.globalMargins.tiny,
        textAlign: 'center',
        width: '100%',
      },
      buttonBar: Kb.Styles.platformStyles({
        isMobile: {
          paddingLeft: Kb.Styles.globalMargins.xsmall,
          paddingRight: Kb.Styles.globalMargins.xsmall,
        },
      }),
      container: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          backgroundColor: Kb.Styles.globalColors.white,
          flexGrow: 1,
          width: '100%',
        },
        isElectron: {maxHeight: '100%'},
      }),
      divider: {marginLeft: 69},
      floatingRolePicker: Kb.Styles.platformStyles({
        isElectron: {
          bottom: -32,
          position: 'relative',
        },
      }),
      meta: {
        alignSelf: 'center',
        marginLeft: Kb.Styles.globalMargins.xtiny,
        marginTop: 2,
      },
      teamRow: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          paddingBottom: Kb.Styles.globalMargins.tiny,
          paddingTop: Kb.Styles.globalMargins.tiny,
          width: '100%',
        },
        isElectron: {
          minHeight: 48,
          paddingLeft: Kb.Styles.globalMargins.tiny,
        },
        isMobile: {
          minHeight: 64,
          paddingLeft: Kb.Styles.globalMargins.xsmall,
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
      }),
      wrapper: Kb.Styles.platformStyles({
        common: {},
        isElectron: {maxHeight: '80%'},
        isMobile: {flexGrow: 1},
      }),
    }) as const
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

  private modal2Props = () => {
    const selectedTeamCount = this.props.selectedTeams.size
    return {
      footer: {
        content: (
          <Kb.ButtonBar fullWidth={true} style={styles.buttonBar}>
            {!Kb.Styles.isMobile && <Kb.Button type="Dim" onClick={this.props.onBack} label="Cancel" />}
            <Kb.WaitingButton
              disabled={selectedTeamCount === 0}
              fullWidth={Kb.Styles.isMobile}
              style={styles.addButton}
              onClick={this.props.onSave}
              label={selectedTeamCount <= 1 ? 'Add to team' : `Add to ${selectedTeamCount} teams`}
              waitingKey={C.Teams.addUserToTeamsWaitingKey(this.props.them)}
            />
          </Kb.ButtonBar>
        ),
      },
      ...(Kb.Styles.isMobile
        ? {
            header: {
              leftButton: (
                <Kb.Text type="BodyBigLink" onClick={this.props.onBack}>
                  Cancel
                </Kb.Text>
              ),
            },
          }
        : {}),
    }
  }

  render() {
    return (
      <Kb.Modal2 {...this.modal2Props()}>
        <Kb.Box2 direction="vertical" style={styles.container} gap="xsmall" gapStart={true}>
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
          <Kb.Box2 direction="horizontal">
            <Kb.Text type="Header">Add</Kb.Text>
            <Kb.Avatar
              isTeam={false}
              size={16}
              style={{
                marginLeft: Kb.Styles.isMobile
                  ? Kb.Styles.globalMargins.xxtiny
                  : Kb.Styles.globalMargins.tiny,
                marginRight: Kb.Styles.globalMargins.tiny,
              }}
              username={this.props.them}
            />
            <Kb.Text type="Header">{this.props.them} to...</Kb.Text>
          </Kb.Box2>
          <Kb.BoxGrow style={{width: '100%'}}>
            <Kb.ScrollView style={{height: '100%', width: '100%'}}>
              <Kb.Box2 direction="vertical" style={{flexShrink: 1, width: '100%'}}>
                {!this.props.waiting ? (
                  this.props.teamProfileAddList.length > 0 ? (
                    this.props.teamProfileAddList.map(team => (
                      <TeamRow
                        canAddThem={!team.disabledReason}
                        checked={this.props.selectedTeams.has(team.teamName)}
                        disabledReason={team.disabledReason}
                        key={team.teamName}
                        name={team.teamName}
                        isOpen={team.open}
                        onCheck={selected => this.props.onToggle(team.teamName, selected)}
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
          </Kb.BoxGrow>
          <Kb.Box2 direction="horizontal" style={styles.addToTeam}>
            <Kb.Text style={styles.addToTeamTitle} type="BodySmall">
              {this.props.them} will be added as a
            </Kb.Text>
            <FloatingRolePicker
              presetRole={this.props.selectedRole}
              floatingContainerStyle={styles.floatingRolePicker}
              footerComponent={this.props.footerComponent}
              onConfirm={this.props.onConfirmRolePicker}
              onCancel={this.props.onCancelRolePicker}
              position="top center"
              open={this.props.isRolePickerOpen}
              disabledRoles={this.props.disabledReasonsForRolePicker}
            >
              <InlineDropdown
                textWrapperType="BodySmall"
                label={this.props.selectedRole}
                onPress={this.props.onOpenRolePicker}
              />
            </FloatingRolePicker>
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Modal2>
    )
  }
}

export default AddToTeam
