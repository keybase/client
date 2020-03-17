import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/teams'
import {useAllChannelMetas} from '../../teams/common/channel-hooks'
import * as GitGen from '../../actions/git-gen'
import * as Constants from '../../constants/teams'

type OwnProps = Container.RouteProps<{
  teamID: Types.TeamID
  repoID: string
  selected: string
}>

const SelectChannel = (ownProps: OwnProps) => {
  const teamID = Container.getRouteProps(ownProps, 'teamID', '')
  const teamname = Container.useSelector(state => Constants.getTeamNameFromID(state, teamID) ?? '')
  const _selected = Container.getRouteProps(ownProps, 'selected', '')
  const repoID = Container.getRouteProps(ownProps, 'repoID', '')

  const channelMetas = useAllChannelMetas(teamID)
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
    <Kb.ScrollView contentContainerStyle={{padding: Styles.globalMargins.large}}>
      <Kb.Box
        style={{
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          flex: 1,
          paddingBottom: Styles.globalMargins.xtiny,
          paddingTop: Styles.globalMargins.xtiny,
        }}
      >
        <Kb.Text type="Header">Select a channel</Kb.Text>
        <Kb.Box
          style={{
            ...Styles.globalStyles.flexBoxColumn,
            marginBottom: Styles.globalMargins.medium,
            marginTop: Styles.globalMargins.medium,
          }}
        >
          {channelNames.map(name => (
            <Kb.Box
              key={name}
              style={
                (Styles.globalStyles.flexBoxRow,
                {paddingLeft: Styles.globalMargins.medium, paddingRight: Styles.globalMargins.medium})
              }
            >
              <Kb.RadioButton
                label={name}
                selected={selected === name}
                style={styles.radioButton}
                onSelect={selected => selected && setSelected(name)}
              />
            </Kb.Box>
          ))}
        </Kb.Box>
        <Kb.Button waiting={waiting} label="Submit" onClick={submit} small={true} />
      </Kb.Box>
    </Kb.ScrollView>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  radioButton: {
    ...Styles.globalStyles.flexBoxRow,
    marginLeft: Styles.globalMargins.tiny,
  },
}))

export default Kb.HeaderOrPopup(SelectChannel)
