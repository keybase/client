// @flow
import * as React from 'react'
import * as Flow from '../../util/flow'
import * as ChatTypes from '../../constants/types/chat2'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import CommaSeparatedName from '../common/comma-separated-name'

type Person = {
  type: 'person',
  name: string,
}

type Group = {
  type: 'group',
  name: string,
}

type SmallTeam = {
  type: 'small-team',
  name: string,
}

type BigTeam = {
  type: 'big-team',
  name: string,
  channels: Array<{|convID: ChatTypes.ConversationIDKey, channelname: string|}>,
  selectChannel: (convID: ChatTypes.ConversationIDKey) => void,
  selectedChannelname?: ?string,
}

type None = {
  type: 'none',
}

type Props = {
  onCancel: () => void,
  conversation: Person | Group | SmallTeam | BigTeam | None,
  pathTextToCopy: string,
  send?: ?() => void,
}

const who = (props: Props) => {
  switch (props.conversation.type) {
    case 'person':
      return props.conversation.name
    case 'group':
      return 'your group'
    case 'small-team':
      return 'team members'
    case 'big-team':
      return 'team members'
    case 'none':
      return ''
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.conversation.type)
      return 'this should not happen'
  }
}

const BigTeamChannelDropdown = ({conversation}: Props) =>
  conversation.type === 'big-team' && (
    <Kb.Dropdown
      style={styles.dropdown}
      items={conversation.channels.map(({convID, channelname}) => (
        <Kb.Box2
          direction="horizontal"
          centerChildren={true}
          gap="tiny"
          gapStart={true}
          key={ChatTypes.conversationIDKeyToString(convID)}
        >
          <Kb.Text type="Body">#{channelname}</Kb.Text>
        </Kb.Box2>
      ))}
      selected={
        conversation.selectedChannelname ? (
          <Kb.Text type="BodyBig" key="placeholder-select">
            #{conversation.selectedChannelname}
          </Kb.Text>
        ) : (
          <Kb.Text type="BodyBig" key="placeholder-select">
            Pick a channel
          </Kb.Text>
        )
      }
      onChanged={(node: React.Node) => {
        if (React.isValidElement(node)) {
          // $FlowIssue React.isValidElement refinement doesn't happen, see https://github.com/facebook/flow/issues/6392
          const element = (node: React.Element<any>)
          // $FlowIssue flow doesn't know key is string
          conversation.selectChannel(ChatTypes.stringToConversationIDKey(element.key))
        }
      }}
    />
  )

const Header = (props: Props) => (
  <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.header} fullWidth={true}>
    {props.conversation.type === 'none' ? (
      <Kb.Text type="Header">Copy link</Kb.Text>
    ) : (
      <>
        <Kb.Text type="Header">Send Link to</Kb.Text>
        <Kb.Box style={styles.headerGap} />
        {(props.conversation.type === 'small-team' || props.conversation.type === 'big-team') && (
          <Kb.Avatar size={16} teamname={props.conversation.name} isTeam={true} style={styles.avatar} />
        )}
        <CommaSeparatedName type="Header" name={props.conversation.name} />
      </>
    )}
  </Kb.Box2>
)

const SendLinkToChat = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container}>
    <Header {...props} />
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
      <Kb.CopyText text={props.pathTextToCopy} containerStyle={styles.copyText} />
      {props.conversation.type !== 'none' && (
        <Kb.Text type="BodyTiny" style={styles.onlyWhoGetAccess}>
          Only {who(props)} will get access to the file.
        </Kb.Text>
      )}
      <BigTeamChannelDropdown {...props} />
    </Kb.Box2>
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.footer} gap="tiny">
      <Kb.Button type="Secondary" label="Cancel" onClick={props.onCancel} />
      {props.conversation.type !== 'none' && (
        <Kb.Button type="Primary" label="Send in conversation" disabled={!props.send} onClick={props.send} />
      )}
    </Kb.Box2>
  </Kb.Box2>
)

export default Kb.HeaderOrPopup(SendLinkToChat)

const styles = Styles.styleSheetCreate({
  avatar: {
    marginRight: Styles.globalMargins.xtiny,
  },
  container: Styles.platformStyles({
    isElectron: {
      height: 480,
      width: 560,
    },
  }),
  copyText: {
    flex: undefined, // unsets flex in CopyText
  },
  dropdown: {
    marginTop: Styles.globalMargins.mediumLarge,
  },
  footer: {
    marginBottom: Styles.globalMargins.large,
  },
  header: {
    flexWrap: 'wrap',
    paddingLeft: Styles.globalMargins.mediumLarge,
    paddingRight: Styles.globalMargins.mediumLarge,
    paddingTop: Styles.globalMargins.mediumLarge,
  },
  headerGap: {
    paddingLeft: Styles.globalMargins.xtiny,
  },
  onlyWhoGetAccess: {
    marginTop: Styles.globalMargins.xsmall,
  },
})
