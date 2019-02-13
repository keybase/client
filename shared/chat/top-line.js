// @flow
import React, {PureComponent} from 'react'
import {PlaintextUsernames, Box, Box2} from '../common-adapters'
import * as Styles from '../styles'

type Props = {
  hasBadge: boolean,
  participants: Array<string>,
  showBold: boolean,
  usernameColor: ?string,
}

class FilteredTopLine extends PureComponent<Props> {
  render() {
    const {hasBadge, participants, showBold, usernameColor} = this.props
    const boldOverride = showBold ? Styles.globalStyles.fontBold : null
    return (
      <Box2 alignItems="center" direction="horizontal" gap="tiny" fullHeight={true} fullWidth={true}>
        <Box style={styles.container}>
          <Box style={styles.innerContainer}>
            <PlaintextUsernames
              type="BodySemibold"
              containerStyle={Styles.collapseStyles([boldOverride, {color: usernameColor}])}
              users={participants.map(p => ({username: p}))}
              title={participants.join(', ')}
            />
          </Box>
        </Box>
        {hasBadge ? <Box key="unreadDot" style={styles.unreadDotStyle} /> : null}
      </Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  innerContainer: {
    ...Styles.globalStyles.fillAbsolute,
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  unreadDotStyle: {
    backgroundColor: Styles.globalColors.orange,
    borderRadius: 6,
    flexShrink: 0,
    height: 8,
    marginLeft: 4,
    width: 8,
  },
})

export {FilteredTopLine}
