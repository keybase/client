// @flow
import * as React from 'react'
import {Box2} from '../../common-adapters'
import Upload from './upload-container'
import Downloads from './downloads-container'

const Footer = () => (
  <Box2 fullWidth={true} direction="vertical">
    <Upload />
    <Downloads />
  </Box2>
)

export default Footer
