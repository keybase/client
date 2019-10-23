import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as MessageTypes from '../../../../constants/types/chat2/message'
import * as I from 'immutable'

type Props = {
  message: I.RecordOf<MessageTypes._MessageJourneycard>
}

const TeamJourney = (props: Props) => {
  const teamname = Container.useSelector(
    state => Constants.getMeta(state, props.message.conversationIDKey).teamname
  )
  return teamname ? (
    <>
      <Kb.Box2 key="author" direction="horizontal" style={styles.authorContainer} gap="tiny">
        <Kb.Avatar size={32} isTeam={true} teamname={teamname} skipBackground={true} style={styles.avatar} />
        <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
          <Kb.Text type="BodySmallBold">{teamname}</Kb.Text>
          <Kb.Text type="BodyTiny">• System message</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Box2 key="content" direction="vertical" fullWidth={true} style={styles.content}>
        <Kb.Text type="Body">
          Team card type {Constants.journeyCardTypeToType[props.message.cardType]}
        </Kb.Text>
      </Kb.Box2>
    </>
  ) : (
    <Kb.Box2 direction="horizontal" />
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      authorContainer: Styles.platformStyles({
        common: {
          alignItems: 'flex-start',
          alignSelf: 'flex-start',
          height: Styles.globalMargins.mediumLarge,
        },
        isMobile: {marginTop: 8},
      }),
      avatar: Styles.platformStyles({
        isElectron: {
          marginLeft: Styles.globalMargins.small,
        },
        isMobile: {marginLeft: Styles.globalMargins.tiny},
      }),
      content: Styles.platformStyles({
        isElectron: {
          marginTop: -16,
          paddingLeft:
            // Space for below the avatar
            Styles.globalMargins.tiny + // right margin
            Styles.globalMargins.small + // left margin
            Styles.globalMargins.mediumLarge, // avatar
        },
        isMobile: {
          marginTop: -12,
          paddingBottom: 3,
          paddingLeft:
            // Space for below the avatar
            Styles.globalMargins.tiny + // right margin
            Styles.globalMargins.tiny + // left margin
            Styles.globalMargins.mediumLarge, // avatar
          paddingRight: Styles.globalMargins.tiny,
        },
      }),
    } as const)
)

export default TeamJourney
