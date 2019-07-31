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

const OutOfDate = ({outOfDate, updateNow}: Props) => {
  if (!flags.outOfDateBanner || !outOfDate) return null
  const bannerColor = outOfDate.critical ? 'red' : 'yellow'
  return (
    <Kb.Banner color={bannerColor} style={styles.banner} textContainerStyle={styles.textContainerStyle}>
      <Kb.BannerParagraph bannerColor={bannerColor} content={getOutOfDateText(outOfDate)} />
      {outOfDate.updating ? (
        <Kb.BannerParagraph bannerColor={bannerColor} content="Updating…" />
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
    </Kb.Banner>
  )
}

const styles = Styles.styleSheetCreate({
  banner: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
  textContainerStyle: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  textCritical: {
    color: Styles.globalColors.white,
  },
  textNonCritical: {
    color: Styles.globalColors.brown_75,
  },
})

export default OutOfDate
