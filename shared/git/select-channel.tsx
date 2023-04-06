import * as Constants from '../constants/teams'
import * as Container from '../util/container'
import * as GitGen from '../actions/git-gen'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Styles from '../styles'
import {useAllChannelMetas} from '../teams/common/channel-hooks'

type OwnProps = Container.RouteProps<'gitSelectChannel'>

const SelectChannel = (ownProps: OwnProps) => {
  const {params} = ownProps.route
  const teamID = params?.teamID ?? ''
  const _selected = params?.selected ?? ''
  const repoID = params?.repoID ?? ''
  const teamname = Container.useSelector(state => Constants.getTeamNameFromID(state, teamID) ?? '')

  const {channelMetas} = useAllChannelMetas(teamID)
  const waiting = channelMetas === null
  const channelNames = channelMetas ? [...channelMetas.values()].map(info => info.channelname) : []

  const [selected, setSelected] = React.useState(_selected)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const onSubmit = (channelName: string) =>
    dispatch(
      GitGen.createSetTeamRepoSettings({
        channelName,
        chatDisabled: false,
        repoID: repoID,
        teamname: teamname,
      })
    )
  const onCancel = () => dispatch(nav.safeNavigateUpPayload())

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
