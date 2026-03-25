import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useRouteNavigation} from '@/constants/router'

const ButtonRow = (props: {teamID: T.Teams.TeamID}) => {
  const nav = useRouteNavigation()
  const onCreateChannel = () =>
    nav.navigateAppend({name: 'chatCreateChannel', params: {...props, navToChatOnSuccess: false}})

  const waitingKey = C.waitingKeyTeamsGetChannels(props.teamID)
  const waitingForGet = C.Waiting.useAnyWaiting(waitingKey)

  return (
    <Kb.Box2 direction="horizontal" style={styles.container} fullWidth={true} gap="small" justifyContent="flex-start">
      <Kb.Button small={true} mode="Secondary" label="Create channel" onClick={onCreateChannel} />
      {waitingForGet && <Kb.ProgressIndicator type="Small" />}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    backgroundColor: Kb.Styles.globalColors.blueGrey,
    ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
  },
}))

export default ButtonRow
