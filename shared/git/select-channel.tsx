import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import {useAllChannelMetas} from '../teams/common/channel-hooks'
import {useSafeNavigation} from '@/util/safe-navigation'

type OwnProps = {
  teamID: T.Teams.TeamID
  repoID: string
  selected: string
  teamname: string
}

const SelectChannel = (ownProps: OwnProps) => {
  const styles = useStyles()
  const {teamID, repoID, teamname} = ownProps
  const _selected = ownProps.selected
  const {channelMetas} = useAllChannelMetas(teamID)
  const submitting = C.Waiting.useAnyWaiting(C.waitingKeyGitLoading)
  const waiting = channelMetas.size === 0 || submitting
  const channelNames = [...channelMetas.values()].map(info => info.channelname)
  const [selected, setSelected] = React.useState(_selected)
  const [error, setError] = React.useState('')
  const {safeNavigateUp} = useSafeNavigation()
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
        safeNavigateUp()
      },
      err => {
        setError(err.message)
      }
    )
  const onCancel = () => C.Router2.navigateUp()

  const submit = () => {
    setError('')
    onSubmit(selected)
  }

  return (
    <Kb.ModalScreen
      banner={<Kb.ErrorBanner error={error} />}
      footer={
        <Kb.ConfirmButtons
          split={true}
          waiting={waiting}
          onCancel={onCancel}
          onConfirm={submit}
          confirmLabel="Submit"
        />
      }
    >
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
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
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  radioButton: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    marginLeft: Kb.Styles.globalMargins.tiny,
  },
  row: {
    ...Kb.Styles.paddingH(Kb.Styles.globalMargins.tiny),
  },
}))

export default SelectChannel
