// @flow
import * as React from 'react'
import {Meta} from '../../../../common-adapters'
import {globalColors, platformStyles, styleSheetCreate} from '../../../../styles'
import {formatDurationShort} from '../../../../util/timestamp'

export const ExplodingMeta = ({
  explodingModeSeconds,
  isNew,
}: {
  explodingModeSeconds: number,
  isNew: boolean,
}) => {
  if (explodingModeSeconds === 0 && !isNew) {
    // nothing to show
    return null
  }
  return (
    <Meta
      backgroundColor={explodingModeSeconds === 0 ? globalColors.blue : globalColors.black_75_on_white}
      noUppercase={explodingModeSeconds !== 0}
      style={styles.newBadge}
      size="Small"
      title={explodingModeSeconds === 0 ? 'New' : formatDurationShort(explodingModeSeconds * 1000)}
    />
  )
}

const styles = styleSheetCreate({
  newBadge: platformStyles({
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
