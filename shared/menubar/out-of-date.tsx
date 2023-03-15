import * as Kb from '../common-adapters'
import * as Container from '../util/container'
import * as ConfigGen from '../actions/config-gen'
import * as Styles from '../styles'
import {isWindows, isDarwin} from '../constants/platform'
import type * as ConfigTypes from '../constants/types/config'

type Props = {
  outOfDate?: ConfigTypes.OutOfDate
}

const getOutOfDateText = (outOfDate: ConfigTypes.OutOfDate) =>
  `Your Keybase app is ${outOfDate.critical ? 'critically ' : ''}out of date` +
  (outOfDate.message ? `: ${outOfDate.message}` : '.')

const OutOfDate = ({outOfDate}: Props) => {
  const dispatch = Container.useDispatch()
  const updateNow = isWindows || isDarwin ? () => dispatch(ConfigGen.createUpdateNow()) : undefined

  if (!outOfDate) return null
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

const styles = Styles.styleSheetCreate(() => ({
  banner: {
    flexShrink: 0,
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
}))

export default OutOfDate
