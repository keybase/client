import * as C from '@/constants'
import * as Constants from '@/constants/crypto'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {Input, InputActionsBar, DragAndDrop, OperationBanner} from '../input'
import {OperationOutput, SignedSender, OutputActionsBar} from '../output'

const operation = Constants.Operations.Verify

export const VerifyInput = () => {
  const resetOperation = C.useCryptoState(s => s.dispatch.resetOperation)
  React.useEffect(() => {
    return () => {
      if (C.isMobile) {
        resetOperation(operation)
      }
    }
  }, [resetOperation])

  const content = (
    <>
      <OperationBanner operation={operation} />
      <Input operation={operation} />
      {C.isMobile ? <InputActionsBar operation={operation} /> : null}
    </>
  )

  return C.isMobile ? (
    <Kb.KeyboardAvoidingView2>{content}</Kb.KeyboardAvoidingView2>
  ) : (
    <Kb.Box2 direction="vertical" fullHeight={true} style={Constants.inputDesktopMaxHeight}>
      {content}
    </Kb.Box2>
  )
}
export const VerifyOutput = () => {
  const errorMessage = C.useCryptoState(s => s[operation].errorMessage.stringValue())
  const content = (
    <>
      {C.isMobile && errorMessage ? <OperationBanner key="banner" operation={operation} /> : null}
      <SignedSender operation={operation} />
      {C.isMobile ? <Kb.Divider /> : null}
      <OperationOutput operation={operation} />
      <OutputActionsBar operation={operation} />
    </>
  )
  return C.isMobile ? (
    content
  ) : (
    <Kb.Box2 direction="vertical" fullHeight={true} style={Constants.outputDesktopMaxHeight}>
      {content}
    </Kb.Box2>
  )
}

export const VerifyIO = () => {
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
