import * as React from 'react'
import * as Kb from '../../common-adapters'
import Upload from './upload-container'
import Downloads from './downloads-container'

const Footer = () => (
  <Kb.Box2 fullWidth={true} direction="vertical">
    <Upload />
    <Downloads />
  </Kb.Box2>
)

export default Footer
