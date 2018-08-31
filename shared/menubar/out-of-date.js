// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'

type Props = {
  outOfDate: boolean,
  critical: boolean,
  updateNow?: () => void,
}

const OutOfDate = ({outOfDate, critical, updateNow}: Props) =>
  outOfDate && (
    <Kb.Box2
      style={critical ? styles.boxCritical : styles.boxNonCritical}
      fullWidth={true}
      centerChildren={true}
      direction="vertical"
    >
      <Kb.Text type="BodySemibold" style={critical ? styles.textCritical : styles.textNonCritical}>
        Your Keybase app is {critical && 'critically'} out of date.
      </Kb.Text>
      <Kb.Text type="BodySemibold" style={critical ? styles.textCritical : styles.textNonCritical}>
        Please{' '}
        <Kb.Text
          type="BodySemibold"
          underline={!!updateNow}
          style={critical ? styles.textCritical : styles.textNonCritical}
          onClick={updateNow}
        >
          update now
        </Kb.Text>.
      </Kb.Text>
    </Kb.Box2>
  )

const styles = Styles.styleSheetCreate({
  boxCritical: {
    backgroundColor: Styles.globalColors.red,
    padding: Styles.globalMargins.tiny,
  },
  textCritical: {
    color: Styles.globalColors.white,
  },
  boxNonCritical: {
    backgroundColor: Styles.globalColors.lightGrey,
    padding: Styles.globalMargins.tiny,
  },
  textNonCritical: {
    color: Styles.globalColors.black,
  },
})

export default OutOfDate
