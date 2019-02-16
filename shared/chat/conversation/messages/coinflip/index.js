// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

export type Props = {|
  progressText: string,
  resultText: string,
  isError: boolean,
  showParticipants: boolean,
|}

const CoinFlip = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} gap="tiny">
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Text type="BodySmall">Progress</Kb.Text>
        <Kb.Text
          type="BodyItalic"
          style={Styles.collapseStyles([styles.progress, props.isError ? styles.error : null])}
        >
          {props.progressText}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
          <Kb.Text type="BodySmall">Result</Kb.Text>
          {props.showParticipants && (
            <Kb.Text type="BodySmallPrimaryLink" style={styles.participantsLabel}>
              View Participants
            </Kb.Text>
          )}
        </Kb.Box2>
        <Kb.Text type="BodySemibold" style={styles.result}>
          {props.resultText.length > 0 ? props.resultText : '???'}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  container: {
    alignSelf: 'flex-start',
    borderColor: Styles.globalColors.lightGrey,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    marginTop: Styles.globalMargins.xtiny,
    padding: Styles.globalMargins.tiny,
  },
  error: {
    color: Styles.globalColors.red,
  },
  participantsLabel: Styles.platformStyles({
    isElectron: {
      lineHeight: 16,
    },
  }),
  progress: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
  result: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
})

export default CoinFlip
