import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as ChatTypes from '../../../constants/types/chat2'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import {Tab as TabType} from '../../../common-adapters/tabs'

export type TabKey = 'members' | 'attachments' | 'bots' | 'settings' | 'loading'

export type Props = {
  admin: boolean
  teamID: Types.TeamID
  conversationIDKey: ChatTypes.ConversationIDKey
  selectedTab: TabKey
  setSelectedTab: (t: TabKey) => void
}

const ChannelTabs = (props: Props) => {
  const {selectedTab, setSelectedTab} = props
  const error = Container.useSelector(state => state.teams.errorInAddToTeam)
  const tabs: Array<TabType<TabKey>> = [
    {title: 'members' as const},
    {title: 'attachments' as const},
    {title: 'bots' as const},
    ...(props.admin ? [{title: 'settings' as const}] : []),
  ]

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box style={styles.container}>
        <Kb.Tabs tabs={tabs} selectedTab={selectedTab} onSelect={setSelectedTab} />
      </Kb.Box>
      {!!error && <Kb.Banner color="red">{error}</Kb.Banner>}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    backgroundColor: Styles.globalColors.white,
    width: '100%',
  },
}))

export default ChannelTabs
