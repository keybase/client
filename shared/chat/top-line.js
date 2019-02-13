// @flow
import React, {PureComponent} from 'react'
import {PlaintextUsernames, Box} from '../common-adapters'
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
      <Box style={styles.container}>
        <Box style={styles.innerContainer}>
          <PlaintextUsernames
            type="BodySemibold"
            containerStyle={Styles.collapseStyles([boldOverride, {color: usernameColor}, styles.usernames])}
            users={participants.map(p => ({username: p}))}
            title={participants.join(', ')}
          />
        </Box>
      </Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
    position: 'relative',
  },
  innerContainer: {
    ...Styles.globalStyles.fillAbsolute,
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  usernames: {paddingRight: 7},
})

export {FilteredTopLine}
