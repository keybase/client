// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/chat2'
import AddPeople from './add-people'

type Props = {
  label: string,
  participantCount: number,
  isAdmin: boolean,
  isGeneralChannel: boolean,
  teamname: ?string,
  conversationIDKey: Types.ConversationIDKey,
}

const ParticipantCount = (props: Props) => (
  <Kb.Box2 direction="horizontal" style={styles.container}>
    <Kb.Text type="BodySmallSemibold" style={styles.text}>
      {props.label} ({props.participantCount.toString()})
    </Kb.Text>
    <AddPeople
      isAdmin={props.isAdmin}
      isGeneralChannel={props.isGeneralChannel}
      teamname={props.teamname}
      conversationIDKey={props.conversationIDKey}
    />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  buttonContainer: {
    position: 'absolute',
    right: 0,
    top: -Styles.globalMargins.xtiny,
  },
  container: {
    marginRight: Styles.globalMargins.small,
    position: 'relative',
  },
  text: {
    paddingLeft: Styles.globalMargins.small,
  },
})

export {ParticipantCount}
