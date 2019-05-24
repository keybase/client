import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {formatDurationShort} from '../../../../util/timestamp'

export const ExplodingMeta = ({explodingModeSeconds}: {explodingModeSeconds: number}) => {
  if (explodingModeSeconds === 0) {
    // nothing to show
    return null
  }
  return (
    <Kb.Meta
      backgroundColor={Styles.globalColors.black_on_white}
      noUppercase={true}
      style={styles.timeBadge}
      size="Small"
      title={formatDurationShort(explodingModeSeconds * 1000)}
    />
  )
}

const styles = Styles.styleSheetCreate({
  timeBadge: Styles.platformStyles({
    common: {
      borderColor: Styles.globalColors.white,
      borderRadius: 3,
      borderStyle: 'solid',
    },
    isElectron: {
      borderWidth: 1,
      cursor: 'pointer',
      marginLeft: -11,
      marginTop: -6,
    },
    isMobile: {
      borderWidth: 2,
      marginLeft: -5,
      marginTop: -1,
    },
  }),
})
