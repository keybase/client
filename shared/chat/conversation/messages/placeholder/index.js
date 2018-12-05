// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box2, ProgressIndicator} from '../../../../common-adapters'
import {globalColors, styleSheetCreate, collapseStyles, isMobile} from '../../../../styles'

type Props = {|
  ordinal: Types.Ordinal,
|}

const baseWidth = isMobile ? 100 : 150
const mult = isMobile ? 5 : 10

class Placeholder extends React.PureComponent<Props> {
  render() {
    const o = Types.ordinalToNumber(this.props.ordinal)
    const code = o * 16807
    const width = baseWidth + (code % 20) * mult // pseudo randomize the length
    return (
      <Box2 direction="horizontal" gap="tiny" style={styles.container}>
        <ProgressIndicator type="Small" style={styles.spinner} />
        <Box2 direction="horizontal" style={collapseStyles([styles.greyBar, {width}])} />
      </Box2>
    )
  }
}

const styles = styleSheetCreate({
  container: {
    alignItems: 'center',
    height: isMobile ? 22 : 17, // to match a line of text
    width: '100%',
  },
  greyBar: {
    backgroundColor: globalColors.lightGrey,
    height: 10,
  },
  spinner: {
    height: 13,
    marginLeft: 0,
  },
})

export default Placeholder
