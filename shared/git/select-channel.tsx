import * as Git from '@/stores/git'
import * as Teams from '@/stores/teams'
import {useSafeNavigation} from '@/util/safe-navigation'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import {useAllChannelMetas} from '../teams/common/channel-hooks'

type OwnProps = {
  teamID: T.Teams.TeamID
  repoID: string
  selected: string
}

const SelectChannel = (ownProps: OwnProps) => {
  const {teamID, repoID} = ownProps
  const _selected = ownProps.selected
  const teamname = Teams.useTeamsState(s => Teams.getTeamNameFromID(s, teamID) ?? '')
  const {channelMetas} = useAllChannelMetas(teamID)
  const waiting = channelMetas.size === 0 // TODO fix this?
  const channelNames = [...channelMetas.values()].map(info => info.channelname)
  const [selected, setSelected] = React.useState(_selected)
  const nav = useSafeNavigation()
  const setTeamRepoSettings = Git.useGitState(s => s.dispatch.setTeamRepoSettings)
  const onSubmit = (channelName: string) => setTeamRepoSettings(channelName, teamname, repoID, false)
  const onCancel = () => nav.safeNavigateUp()

  const submit = () => {
    onSubmit(selected)
    onCancel()
  }

  // TODO: this modal could use a little bit of love
  return (
    <Kb.PopupWrapper>
      <Kb.Box2 direction="vertical" fullHeight={true} style={styles.container}>
        <Kb.ScrollView contentContainerStyle={styles.scrollContainer}>
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.innerContainer} gap="tiny">
            <Kb.Text type="Header">Select a channel</Kb.Text>
            {channelNames.map(name => (
              <Kb.Box key={name} style={styles.row}>
                <Kb.RadioButton
                  label={name}
                  selected={selected === name}
                  style={styles.radioButton}
                  onSelect={selected => selected && setSelected(name)}
                />
              </Kb.Box>
            ))}
          </Kb.Box2>
        </Kb.ScrollView>
        <Kb.ButtonBar>
          <Kb.Button label="Cancel" onClick={onCancel} small={true} type="Dim" />
          <Kb.Button waiting={waiting} label="Submit" onClick={submit} small={true} />
        </Kb.ButtonBar>
      </Kb.Box2>
    </Kb.PopupWrapper>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    width: Kb.Styles.isMobile ? '100%' : 300,
  },
  innerContainer: {
    paddingBottom: Kb.Styles.globalMargins.xtiny,
    paddingTop: Kb.Styles.globalMargins.xtiny,
  },
  radioButton: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    marginLeft: Kb.Styles.globalMargins.tiny,
  },
  row: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    paddingLeft: Kb.Styles.globalMargins.tiny,
    paddingRight: Kb.Styles.globalMargins.tiny,
  },
  scrollContainer: {padding: Kb.Styles.globalMargins.small},
}))

export default SelectChannel
