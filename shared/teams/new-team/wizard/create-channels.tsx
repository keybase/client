import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {ModalTitle} from '../../common'

type Props = {
  teamname: string
}

const CreateChannel = (props: Props) => {
  return (
    <Kb.Modal
      header={{
        // leftButton: <Kb.Back,
        title: <ModalTitle teamname={props.teamname}>Create channels</ModalTitle>,
      }}
      allowOverflow={true}
    >
      <Kb.Text type="Header">Add</Kb.Text>
    </Kb.Modal>
  )
}

export default CreateChannel
