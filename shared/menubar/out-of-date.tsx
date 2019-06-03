import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as ConfigTypes from '../constants/types/config'
import flags from '../util/feature-flags'

type Props = {
  // eslint-disable-next-line no-use-before-define
  outOfDate?: ConfigTypes.OutOfDate
  updateNow?: () => void
}

const getOutOfDateText = (outOfDate: ConfigTypes.OutOfDate) =>
  `Your Keybase app is ${outOfDate.critical ? 'critically ' : ''}out of date` +
  (outOfDate.message ? `: ${outOfDate.message}` : '.')

const OutOfDate = ({outOfDate, updateNow}: Props) =>
  flags.outOfDateBanner &&
  !!outOfDate && (
    <Kb.Box2
      style={outOfDate.critical ? styles.boxCritical : styles.boxNonCritical}
      fullWidth={true}
      centerChildren={true}
      direction="vertical"
    >
      <Kb.Text
        type="BodySmallSemibold"
        style={outOfDate.critical ? styles.textCritical : styles.textNonCritical}
      >
        {getOutOfDateText(outOfDate)}
      </Kb.Text>
      {outOfDate.updating ? (
        <Kb.Text
          type="BodySmallSemibold"
          style={outOfDate.critical ? styles.textCritical : styles.textNonCritical}
        >
          Updating ...
        </Kb.Text>
      ) : (
        <Kb.Text
          type="BodySmallSemibold"
          style={outOfDate.critical ? styles.textCritical : styles.textNonCritical}
        >
          Please{' '}
          <Kb.Text
            type="BodySmallSemibold"
            underline={!!updateNow}
            style={outOfDate.critical ? styles.textCritical : styles.textNonCritical}
            onClick={updateNow}
          >
            update now
          </Kb.Text>
          .
        </Kb.Text>
      )}
    </Kb.Box2>
  )

const styles = Styles.styleSheetCreate({
  boxCritical: {
    backgroundColor: Styles.globalColors.red,
    minHeight: 40,
    padding: Styles.globalMargins.tiny,
  },
  boxNonCritical: {
    backgroundColor: Styles.globalColors.yellow,
    minHeight: 40,
    padding: Styles.globalMargins.tiny,
  },
  textCritical: {
    color: Styles.globalColors.white,
  },
  textNonCritical: {
    color: Styles.globalColors.brown_75,
  },
})

export default OutOfDate
