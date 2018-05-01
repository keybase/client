// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box2, ProgressIndicator} from '../../../../common-adapters'
import {globalColors, styleSheetCreate, collapseStyles, isMobile} from '../../../../styles'

type Props = {
  ordinal: Types.Ordinal,
}

const baseWidth = isMobile ? 100 : 150

class Placeholder extends React.PureComponent<Props> {
  render() {
    const o = Types.ordinalToNumber(this.props.ordinal)
    const code = o * 16807
    const width = baseWidth + (code % 20) * 20 // pseudo randomize the length
    return (
      <Box2 direction="horizontal" gap="tiny">
        <ProgressIndicator type="Small" style={styles.spinner} />
        <Box2 direction="horizontal" style={collapseStyles([styles.greyBar, {width}])} />
      </Box2>
    )
  }
}

const styles = styleSheetCreate({
  container: {
    height: 17, // to match a line of text
  },
  greyBar: {
    backgroundColor: globalColors.lightGrey,
    height: 10,
  },
  spinner: {
    height: 13,
    marginLeft: 40,
  },
})

export default Placeholder
