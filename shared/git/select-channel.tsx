import * as TConstants from '../constants/teams'
import * as Constants from '../constants/git'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Styles from '../styles'
import type * as TeamsTypes from '../constants/types/teams'
import {useAllChannelMetas} from '../teams/common/channel-hooks'

type OwnProps = {
  teamID: TeamsTypes.TeamID
  repoID: string
  selected: string
}

const SelectChannel = (ownProps: OwnProps) => {
  const {teamID, repoID} = ownProps
  const _selected = ownProps.selected
  const teamname = TConstants.useState(s => TConstants.getTeamNameFromID(s, teamID) ?? '')
  const {channelMetas} = useAllChannelMetas(teamID)
  const waiting = channelMetas === null
  const channelNames = channelMetas ? [...channelMetas.values()].map(info => info.channelname) : []
  const [selected, setSelected] = React.useState(_selected)
  const nav = Container.useSafeNavigation()
  const setTeamRepoSettings = Constants.useState(s => s.dispatch.setTeamRepoSettings)
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

const styles = Styles.styleSheetCreate(() => ({
  container: {
    width: Styles.isMobile ? '100%' : 300,
  },
  innerContainer: {
    paddingBottom: Styles.globalMargins.xtiny,
    paddingTop: Styles.globalMargins.xtiny,
  },
  radioButton: {
    ...Styles.globalStyles.flexBoxRow,
    marginLeft: Styles.globalMargins.tiny,
  },
  row: {
    ...Styles.globalStyles.flexBoxRow,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
  },
  scrollContainer: {padding: Styles.globalMargins.small},
}))

export default SelectChannel
