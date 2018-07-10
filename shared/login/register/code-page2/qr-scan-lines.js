// @flow
import * as React from 'react'
import {Box} from '../../../common-adapters'
import {globalColors, styleSheetCreate, collapseStyles} from '../../../styles'

const long = 22
const small = 4
const padding = 5

const BadLines = () => null

// Note: duplicating the lines here vs a series of maps / permutations so its more readable
const GoodLines = () => (
  <React.Fragment>
    <Box style={collapseStyles([styles.common, {height: long, left: padding, top: padding, width: small}])} />
    <Box style={collapseStyles([styles.common, {height: small, left: padding, top: padding, width: long}])} />
    <Box
      style={collapseStyles([styles.common, {height: long, right: padding, top: padding, width: small}])}
    />
    <Box
      style={collapseStyles([styles.common, {height: small, right: padding, top: padding, width: long}])}
    />
    <Box
      style={collapseStyles([styles.common, {bottom: padding, height: long, left: padding, width: small}])}
    />
    <Box
      style={collapseStyles([styles.common, {bottom: padding, height: small, left: padding, width: long}])}
    />
    <Box
      style={collapseStyles([styles.common, {bottom: padding, height: long, right: padding, width: small}])}
    />
    <Box
      style={collapseStyles([styles.common, {bottom: padding, height: small, right: padding, width: long}])}
    />
  </React.Fragment>
)

const QRScanLines = ({canScan}: {canScan: boolean}) => (canScan ? <GoodLines /> : <BadLines />)

const styles = styleSheetCreate({
  common: {
    backgroundColor: globalColors.blue,
    position: 'absolute',
  },
})

export default QRScanLines
