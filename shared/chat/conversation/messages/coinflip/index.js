// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

export type Props = {|
  displayText: string,
  isResult: boolean,
  showParticipants: boolean,
|}

const CoinFlip = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" gap="tiny" style={styles.container}>
      <Kb.Text type={props.isResult ? 'BodySemibold' : 'BodyItalic'}>{props.displayText}</Kb.Text>
      {props.showParticipants && <Kb.Text type="BodyPrimaryLink">View Participants</Kb.Text>}
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
    minHeight: 54,
    padding: Styles.globalMargins.xtiny,
    width: 250,
  },
})

export default CoinFlip
