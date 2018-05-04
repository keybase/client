// @flow
import * as React from 'react'
import {Box2, Button} from '../../../common-adapters'
import Available from '../available'

type Props = {
  onClick: Function,
}

const Footer = ({onClick}: Props) => (
  <Box2 direction="vertical">
    <Button type="Primary" label="Send" onClick={onClick} />
    <Available />
  </Box2>
)

export default Footer
