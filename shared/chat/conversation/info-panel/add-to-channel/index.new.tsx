import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {}

const AddToChannel = (props: Props) => {
  return (
    <Kb.Modal header={{title: <Kb.Text type="Header">Hello, world</Kb.Text>}}>
      <Kb.Text type="HeaderBig">Goodbye</Kb.Text>
    </Kb.Modal>
  )
}

export default AddToChannel
