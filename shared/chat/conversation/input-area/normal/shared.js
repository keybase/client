// @flow
import * as React from 'react'
import {Meta} from '../../../../common-adapters'
import {globalColors, platformStyles, styleSheetCreate} from '../../../../styles'
import {messageExplodeDescriptions} from '../../../../constants/chat2'

export const ExplodingMeta = ({explodingModeSeconds}: {explodingModeSeconds: number}) => {
  let title = 'New'

  if (explodingModeSeconds !== 0) {
    const description = messageExplodeDescriptions.find(
      exploding => exploding.seconds === explodingModeSeconds
    )

    if (description) {
      const text = description.text.split(' ')
      title = `${text[0]}${text[1][0]}`
    } else {
      title = null
    }
  }

  return title ? (
    <Meta
      backgroundColor={explodingModeSeconds === 0 ? globalColors.blue : globalColors.black_75_on_white}
      noUppercase={explodingModeSeconds !== 0}
      style={styles.newBadge}
      size="Small"
      title={title}
    />
  ) : null
}

const styles = styleSheetCreate({
  newBadge: platformStyles({
    common: {
      borderColor: 'white',
      borderRadius: 3,
      borderStyle: 'solid',
      borderWidth: 1,
      left: 12,
      position: 'absolute',
      top: -4,
    },
    isElectron: {
      cursor: 'pointer',
    },
  }),
})
