// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as ConfigTypes from '../constants/types/config'

type Props = {
  outOfDate?: ConfigTypes.OutOfDate,
  updateNow?: () => void,
}

const getOutOfDateText = (outOfDate: ConfigTypes.OutOfDate) =>
  `Your Keybase app is ${outOfDate.critical ? 'critically ' : ''}out of date` +
  (outOfDate.message ? `: ${outOfDate.message}` : '.')

const OutOfDate = ({outOfDate, updateNow}: Props) =>
  !!outOfDate && (
    <Kb.Box2
      style={outOfDate.critical ? styles.boxCritical : styles.boxNonCritical}
      fullWidth={true}
      centerChildren={true}
      direction="vertical"
    >
      <Kb.Text type="BodySemibold" style={outOfDate.critical ? styles.textCritical : styles.textNonCritical}>
        {getOutOfDateText(outOfDate)}
      </Kb.Text>
      <Kb.Text type="BodySemibold" style={outOfDate.critical ? styles.textCritical : styles.textNonCritical}>
        Please{' '}
        <Kb.Text
          type="BodySemibold"
          underline={!!updateNow}
          style={outOfDate.critical ? styles.textCritical : styles.textNonCritical}
          onClick={updateNow}
        >
          update now
        </Kb.Text>
        .
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
