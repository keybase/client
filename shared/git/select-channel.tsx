import {useSafeNavigation} from '@/util/safe-navigation'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import {useAllChannelMetas} from '../teams/common/channel-hooks'

type OwnProps = {
  teamID: T.Teams.TeamID
  repoID: string
  selected: string
  teamname: string
}

const SelectChannel = (ownProps: OwnProps) => {
  const {teamID, repoID, teamname} = ownProps
  const _selected = ownProps.selected
  const {channelMetas} = useAllChannelMetas(teamID)
  const submitting = C.Waiting.useAnyWaiting(C.waitingKeyGitLoading)
  const waiting = channelMetas.size === 0 || submitting
  const channelNames = [...channelMetas.values()].map(info => info.channelname)
  const [selected, setSelected] = React.useState(_selected)
  const [error, setError] = React.useState('')
  const nav = useSafeNavigation()
  const setTeamRepoSettings = C.useRPC(T.RPCGen.gitSetTeamRepoSettingsRpcPromise)
  const onSubmit = (channelName: string) =>
    setTeamRepoSettings(
      [
        {
          channelName,
          chatDisabled: false,
          folder: {
            created: false,
            folderType: T.RPCGen.FolderType.team,
            name: teamname,
          },
          repoID,
        },
        C.waitingKeyGitLoading,
      ],
      () => {
        nav.safeNavigateUp()
      },
      err => {
        setError(err.message)
      }
    )
  const onCancel = () => nav.safeNavigateUp()

  const submit = () => {
    setError('')
    onSubmit(selected)
  }

  // TODO: this modal could use a little bit of love
  return (
    <Kb.Box2 direction="vertical" fullHeight={true} style={styles.container}>
      <Kb.ScrollView contentContainerStyle={styles.scrollContainer}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.innerContainer} gap="tiny">
          <Kb.Text type="Header">Select a channel</Kb.Text>
          {!!error && <Kb.Banner color="red">{error}</Kb.Banner>}
          {channelNames.map(name => (
            <Kb.Box2 key={name} direction="horizontal" fullWidth={true} style={styles.row}>
              <Kb.RadioButton
                label={name}
                selected={selected === name}
                style={styles.radioButton}
                onSelect={selected => selected && setSelected(name)}
              />
            </Kb.Box2>
          ))}
        </Kb.Box2>
      </Kb.ScrollView>
      <Kb.ButtonBar>
        <Kb.Button label="Cancel" onClick={onCancel} small={true} type="Dim" />
        <Kb.Button waiting={waiting} label="Submit" onClick={submit} small={true} />
      </Kb.ButtonBar>
    </Kb.Box2>
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
    paddingLeft: Kb.Styles.globalMargins.tiny,
    paddingRight: Kb.Styles.globalMargins.tiny,
  },
  scrollContainer: {padding: Kb.Styles.globalMargins.small},
}))

export default SelectChannel
