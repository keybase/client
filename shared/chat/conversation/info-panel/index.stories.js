// @flow
import React from 'react'
import {storiesOf} from '../../../stories/storybook'
import {SmallTeamInfoPanel} from './index'
import type {SmallTeamInfoPanelProps} from './index'

const props: SmallTeamInfoPanelProps = {
  muted: false,
  onAddParticipant: () => {},
  onMuteConversation: (muted: boolean) => {},
  onShowBlockConversationDialog: () => {},
  onShowNewTeamDialog: () => {},
  onShowProfile: (username: string) => {},
  onToggleInfoPanel: () => {},
  participants: [],
  showTeamButton: false,
}

const load = () => {
  storiesOf('Chat/Conversation/InfoPanel', module).add('Small team', () => {
    return <SmallTeamInfoPanel {...props} />
  })
}

export default load
