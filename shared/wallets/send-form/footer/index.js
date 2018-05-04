// @flow
import * as React from 'react'
import {Box2, Button} from '../../../common-adapters'
import Available from '../available'

type Props = {
  skeleton: null,
  onClick: Function,
}

const Footer = ({skeleton, onClick}: Props) => (
  <Box2 direction="vertical">
    <Button type="Primary" label="Send" onClick={onClick} />
    <Available skeleton={skeleton} />
  </Box2>
)

export default Footer
