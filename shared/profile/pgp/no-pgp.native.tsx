import * as React from 'react'
import * as Kb from '../../common-adapters'
import Modal from '../modal'

const NoPGP = () => {
  return (
    <Modal closeType="none">
      <Kb.Box2 direction="vertical" gap="small" gapEnd={true}>
        <Kb.Text center={true} type="Header">
          Add a PGP key
        </Kb.Text>
        <Kb.Text type="Body">For now, please use our desktop app to create PGP keys.</Kb.Text>
      </Kb.Box2>
    </Modal>
  )
}

export default NoPGP
