import * as C from '../../constants'
import * as Constants from '../../constants/crypto'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import {Input, InputActionsBar, DragAndDrop, OperationBanner} from '../input'
import {OperationOutput, SignedSender, OutputActionsBar} from '../output'

const operation = Constants.Operations.Verify

export const VerifyInput = () => {
  const resetOperation = C.useCryptoState(s => s.dispatch.resetOperation)
  React.useEffect(() => {
    return () => {
      if (Container.isMobile) {
        resetOperation(operation)
      }
    }
  }, [resetOperation])

  const content = (
    <>
      <OperationBanner operation={operation} />
      <Input operation={operation} />
      {Container.isMobile ? <InputActionsBar operation={operation} /> : null}
    </>
  )

  return Container.isMobile ? (
    <Kb.KeyboardAvoidingView2>{content}</Kb.KeyboardAvoidingView2>
  ) : (
    <Kb.Box2 direction="vertical" fullHeight={true} style={Constants.inputDesktopMaxHeight}>
      {content}
    </Kb.Box2>
  )
}
export const VerifyOutput = () => {
  const content = (
    <>
      <SignedSender operation={operation} />
      {Container.isMobile ? <Kb.Divider /> : null}
      <OperationOutput operation={operation} />
      <OutputActionsBar operation={operation} />
    </>
  )
  return Container.isMobile ? (
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
