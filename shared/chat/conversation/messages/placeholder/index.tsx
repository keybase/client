import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box2, ProgressIndicator, Placeholder} from '../../../../common-adapters'
import {styleSheetCreate, isMobile} from '../../../../styles'

type Props = {
  ordinal: Types.Ordinal
}

const baseWidth = isMobile ? 100 : 150
const mult = isMobile ? 5 : 10

class MessagePlaceholder extends React.PureComponent<Props> {
  render() {
    const o = Types.ordinalToNumber(this.props.ordinal)
    const code = o * 16807
    const width = baseWidth + (code % 20) * mult // pseudo randomize the length
    return (
      <Box2 direction="horizontal" gap="tiny" style={styles.container}>
        <ProgressIndicator type="Small" style={styles.spinner} />
        <Placeholder width={width} />
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
  spinner: {
    height: 13,
    marginLeft: 0,
    width: 13,
  },
})

export default MessagePlaceholder
