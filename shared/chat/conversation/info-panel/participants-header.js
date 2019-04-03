// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/chat2'
import AddPeople from './add-people'

type Props = {
  conversationIDKey: Types.ConversationIDKey,
  label: string,
  isAdmin: boolean,
  isGeneralChannel: boolean,
  participantCount: number,
  teamname: ?string,
}

const ParticipantsHeader = (props: Props) => (
  <Kb.Box2 direction="horizontal" style={styles.container}>
    <Kb.Box2 direction="vertical">
      <Kb.Text type="BodySmallSemibold" style={styles.text}>
        {props.label} ({props.participantCount.toString()})
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical">
      <AddPeople
        isAdmin={props.isAdmin}
        isGeneralChannel={props.isGeneralChannel}
        teamname={props.teamname}
        conversationIDKey={props.conversationIDKey}
      />
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: {
    justifyContent: 'space-between',
    marginRight: Styles.globalMargins.small,
    position: 'relative',
  },
  text: {
    paddingLeft: Styles.globalMargins.small,
  },
})

export {ParticipantsHeader}
