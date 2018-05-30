// @flow
import * as React from 'react'
import {Meta} from '../../../../common-adapters'
import {globalColors, platformStyles, styleSheetCreate} from '../../../../styles'
import {formatDurationShort} from '../../../../util/timestamp'

export const ExplodingMeta = ({explodingModeSeconds}: {explodingModeSeconds: number}) => (
  <Meta
    backgroundColor={explodingModeSeconds === 0 ? globalColors.blue : globalColors.black_75_on_white}
    noUppercase={explodingModeSeconds !== 0}
    style={styles.newBadge}
    size="Small"
    title={explodingModeSeconds === 0 ? 'New' : formatDurationShort(explodingModeSeconds * 1000)}
  />
)

const styles = styleSheetCreate({
  newBadge: platformStyles({
    common: {
      borderColor: 'white',
      borderRadius: 3,
      borderStyle: 'solid',
      borderWidth: 1,
    },
    isElectron: {
      cursor: 'pointer',
      left: 12,
      position: 'absolute',
      top: -4,
    },
    isMobile: {
      marginLeft: -5,
      marginTop: -1,
      paddingBottom: 1,
      paddingTop: 1,
    },
  }),
})
