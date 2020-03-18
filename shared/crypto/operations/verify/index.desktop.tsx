import * as React from 'react'
import * as Constants from '../../../constants/crypto'
import * as Kb from '../../../common-adapters'
import {Input, DragAndDrop, OperationBanner} from '../../input'
import {OperationOutput, SignedSender, OutputActionsBar} from '../../output'

const operation = Constants.Operations.Verify

export const VerifyInput = () => (
  <>
    <OperationBanner operation={operation} />
    <Input operation={operation} />
  </>
)
export const VerifyOutput = () => (
  <Kb.Box2 direction="vertical" fullHeight={true}>
    <SignedSender operation={operation} />
    <OperationOutput operation={operation} />
    <OutputActionsBar operation={operation} />
  </Kb.Box2>
)

const Verify = () => {
  return (
    <DragAndDrop operation={operation} prompt="Drop a file to verify">
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <VerifyInput />
        <Kb.Divider />
        <VerifyOutput />
      </Kb.Box2>
    </DragAndDrop>
  )
}

export default Verify
