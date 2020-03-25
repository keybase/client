import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Constants from '../../../constants/crypto'
import Recipients from '../../recipients'
import {DragAndDrop, Input, OperationBanner} from '../../input'
import {OperationOutput, OutputActionsBar, SignedSender} from '../../output'
import {EncryptOptions, EncryptOutputBanner} from './common'

const operation = Constants.Operations.Encrypt

export const EncryptInput = () => {
  return (
    <>
      <OperationBanner operation={operation} />
      <Recipients />
      <Input operation={operation} />
      <EncryptOptions />
    </>
  )
}

export const EncryptOutput = () => (
  <Kb.Box2 direction="vertical" fullHeight={true}>
    <EncryptOutputBanner />
    <SignedSender operation={operation} />
    <OperationOutput operation={operation} />
    <OutputActionsBar operation={operation} />
  </Kb.Box2>
)

const Encrypt = () => (
  <DragAndDrop operation={operation} prompt="Drop a file to encrypt">
    <Kb.Box2 direction="vertical" fullHeight={true}>
      <EncryptInput />
      <EncryptOutput />
    </Kb.Box2>
  </DragAndDrop>
)

export default Encrypt
