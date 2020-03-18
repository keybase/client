import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Kb from '../../../common-adapters'
import {Input, DragAndDrop, OperationBanner} from '../../input'
import {OperationOutput, OutputActionsBar, SignedSender} from '../../output'

const operation = Constants.Operations.Decrypt

export const DecryptInput = () => (
  <>
    <OperationBanner operation={operation} />
    <Input operation={operation} />
  </>
)

export const DecryptOutput = () => (
  <Kb.Box2 direction="vertical" fullHeight={true}>
    <SignedSender operation={operation} />
    <OperationOutput operation={operation} />
    <OutputActionsBar operation={operation} />
  </Kb.Box2>
)

const Decrypt = () => {
  return (
    <DragAndDrop operation={operation} prompt="Drop a file to encrypt">
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <DecryptInput />
        <Kb.Divider />
        <DecryptOutput />
      </Kb.Box2>
    </DragAndDrop>
  )
}

export default Decrypt
