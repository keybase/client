import * as C from '@/constants'
import * as Crypto from '@/stores/crypto'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {Input, DragAndDrop, InputActionsBar, OperationBanner} from '../input'
import {OperationOutput, OutputActionsBar, SignedSender} from '../output'

const operation = Crypto.Operations.Decrypt

export const DecryptInput = () => {
  const resetOperation = Crypto.useCryptoState(s => s.dispatch.resetOperation)
  React.useEffect(() => {
    return () => {
      if (C.isMobile) {
        resetOperation(operation)
      }
    }
  }, [resetOperation])
  const contents = (
    <>
      <OperationBanner key="banner" operation={operation} />
      <Input key="input" operation={operation} />
    </>
  )
  return C.isMobile ? (
    <Kb.KeyboardAvoidingView2>
      {contents}
      <InputActionsBar operation={operation} />
    </Kb.KeyboardAvoidingView2>
  ) : (
    <Kb.Box2 direction="vertical" fullHeight={true} style={Crypto.inputDesktopMaxHeight}>
      {contents}
    </Kb.Box2>
  )
}

export const DecryptOutput = () => {
  const errorMessage = Crypto.useCryptoState(s => s[operation].errorMessage.stringValue())
  const content = (
    <>
      {C.isMobile && errorMessage ? <OperationBanner key="banner" operation={operation} /> : null}
      <SignedSender key="sender" operation={operation} />
      {C.isMobile ? <Kb.Divider key="div" /> : null}
      <OperationOutput key="output" operation={operation} />
      <OutputActionsBar key="bar" operation={operation} />
    </>
  )
  return C.isMobile ? (
    content
  ) : (
    <Kb.Box2 direction="vertical" fullHeight={true} style={Crypto.outputDesktopMaxHeight}>
      {content}
    </Kb.Box2>
  )
}

export const DecryptIO = () => {
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
