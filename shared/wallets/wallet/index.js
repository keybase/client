// @flow
import * as React from 'react'
import {Box2} from '../../common-adapters'
import Header from './header-container'
import Assets from '../asset/container'

export default () => (
  <Box2
    direction="vertical"
    style={{flexGrow: 1}}
    fullHeight={true}
    gap="small"
    gapStart={true}
    gapEnd={true}
  >
    <Header />
    <Assets />
  </Box2>
)
