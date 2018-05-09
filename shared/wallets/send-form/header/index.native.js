// @flow
import * as React from 'react'
import {Box2} from '../../../common-adapters'
import {globalColors, styleSheetCreate} from '../../../styles'

type Props = {}

const Header = (props: Props) => (
  <Box2 direction="horizontal" style={styles.headerContainer}>
    <Box2 direction="horizontal" style={styles.header} />
  </Box2>
)

const styles = styleSheetCreate({
  header: {
    backgroundColor: globalColors.purple,
    width: '100%',
  },
  headerContainer: {
    width: '100%',
  },
})

export default Header
