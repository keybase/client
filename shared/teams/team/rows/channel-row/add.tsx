import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useSafeNavigation} from '@/util/safe-navigation'

const ButtonRow = (props: {teamID: T.Teams.TeamID}) => {
  const nav = useSafeNavigation()
  const onCreateChannel = () =>
    nav.safeNavigateAppend({props: {...props, navToChatOnSuccess: false}, selected: 'chatCreateChannel'})

  const waitingKey = C.Teams.getChannelsWaitingKey(props.teamID)
  const waitingForGet = C.Waiting.useAnyWaiting(waitingKey)

  return (
    <Kb.Box2 direction="horizontal" style={styles.container} fullWidth={true} gap="small">
      <Kb.Button small={true} mode="Secondary" label="Create channel" onClick={onCreateChannel} />
      {waitingForGet && <Kb.ProgressIndicator type="Small" />}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    backgroundColor: Kb.Styles.globalColors.blueGrey,
    justifyContent: 'flex-start',
    ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
  },
}))

export default ButtonRow
