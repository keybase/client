import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Container from '../../../../util/container'
import type * as T from '../../../../constants/types'
import * as Constants from '../../../../constants/teams'

const ButtonRow = (props: {teamID: T.Teams.TeamID}) => {
  const nav = Container.useSafeNavigation()
  const onCreateChannel = () =>
    nav.safeNavigateAppend({props: {...props, navToChatOnSuccess: false}, selected: 'chatCreateChannel'})

  const waitingKey = Constants.getChannelsWaitingKey(props.teamID)
  const waitingForGet = Container.useAnyWaiting(waitingKey)

  return (
    <Kb.Box2 direction="horizontal" style={styles.container} fullWidth={true} gap="small">
      <Kb.Button small={true} mode="Secondary" label="Create channel" onClick={onCreateChannel} />
      {waitingForGet && <Kb.ProgressIndicator type="Small" />}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    backgroundColor: Styles.globalColors.blueGrey,
    justifyContent: 'flex-start',
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
  },
}))

export default ButtonRow
