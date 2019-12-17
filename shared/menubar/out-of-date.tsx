import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as ConfigTypes from '../constants/types/config'

type Props = {
  updateInfo?: ConfigTypes.UpdateInfo
  updateStart?: () => void
}

const getCriticallyOutOfDateText = (updateInfo: ConfigTypes.UpdateInfo) =>
  updateInfo.status === 'critical'
    ? `Your Keybase app is critically out of date${
        updateInfo.critical ? ` ${updateInfo.critical.message}` : ''
      }.`
    : ''

const OutOfDate = ({updateInfo, updateStart}: Props) => {
  if (!updateInfo) return null
  const isCritical = updateInfo.status === 'critical'
  const isSuggested = updateInfo.status === 'suggested'
  const needUpdate = isCritical || isSuggested
  const bannerColor = isCritical ? 'red' : 'yellow'
  return needUpdate ? (
    <Kb.Banner color={bannerColor} style={styles.banner} textContainerStyle={styles.textContainerStyle}>
      <Kb.BannerParagraph bannerColor={bannerColor} content={getCriticallyOutOfDateText(updateInfo)} />
      {updateInfo.updating ? (
        <Kb.BannerParagraph bannerColor={bannerColor} content="Updating…" />
      ) : (
        <Kb.Text type="BodySmallSemibold" style={isCritical ? styles.textCritical : styles.textNonCritical}>
          Please{' '}
          <Kb.Text
            type="BodySmallSemibold"
            underline={!!updateStart}
            style={isCritical ? styles.textCritical : styles.textNonCritical}
            onClick={updateStart}
          >
            update now
          </Kb.Text>
          .
        </Kb.Text>
      )}
    </Kb.Banner>
  ) : null
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
