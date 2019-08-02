import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Sb from '../../../stories/storybook'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'

import CommandStatus from './index'

const errorProps = {
  actions: [],
  displayText: 'Failed to send message.',
  displayType: RPCChatTypes.UICommandStatusDisplayTyp.error,
  onCancel: Sb.action('onCancel'),
}

const warningProps = {
  ...errorProps,
  displayType: RPCChatTypes.UICommandStatusDisplayTyp.warning,
}

const statusProps = {
  ...errorProps,
  displayType: RPCChatTypes.UICommandStatusDisplayTyp.status,
}

const singleActionProps = {
  ...errorProps,
  actions: [{displayText: 'View Settings', onClick: Sb.action('appSettings')}],
}

const multiActionProps = {
  ...errorProps,
  actions: [
    {displayText: 'View Settings', onClick: Sb.action('appSettings')},
    {displayText: 'End it All', onClick: Sb.action('endItAll')},
  ],
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/CommandStatus', module)
    .addDecorator(story => <Kb.Box style={{maxWidth: 600, padding: 5}}>{story()}</Kb.Box>)
    .add('Error', () => <CommandStatus {...errorProps} />)
    .add('Warning', () => <CommandStatus {...warningProps} />)
    .add('Status', () => <CommandStatus {...statusProps} />)
    .add('Single', () => <CommandStatus {...singleActionProps} />)
    .add('Multi', () => <CommandStatus {...multiActionProps} />)
}

export default load
