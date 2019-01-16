// @flow
import * as React from 'react'
import {Meta} from '../../../../common-adapters'
import {globalColors, platformStyles, styleSheetCreate} from '../../../../styles'
import {formatDurationShort} from '../../../../util/timestamp'

export const ExplodingMeta = ({explodingModeSeconds}: {explodingModeSeconds: number}) => {
  if (explodingModeSeconds === 0) {
    // nothing to show
    return null
  }
  return (
    <Meta
      backgroundColor={globalColors.black_75_on_white}
      noUppercase={true}
      style={styles.timeBadge}
      size="Small"
      title={formatDurationShort(explodingModeSeconds * 1000)}
    />
  )
}

const styles = styleSheetCreate({
  timeBadge: platformStyles({
    common: {
      borderColor: globalColors.white,
      borderRadius: 3,
      borderStyle: 'solid',
      paddingBottom: 1,
      paddingTop: 1,
    },
    isElectron: {
      borderWidth: 1,
      cursor: 'pointer',
      marginLeft: -11,
      marginTop: -6,
    },
    isMobile: {
      borderWidth: 2,
      height: 18,
      marginLeft: -5,
      marginTop: -1,
    },
  }),
})
