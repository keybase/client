import * as C from '../../constants'
import * as Constants from '../../constants/crypto'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import {Input, DragAndDrop, InputActionsBar, OperationBanner} from '../input'
import {OperationOutput, OutputActionsBar, SignedSender} from '../output'

const operation = Constants.Operations.Decrypt

export const DecryptInput = () => {
  const resetOperation = C.useCryptoState(s => s.dispatch.resetOperation)
  React.useEffect(() => {
    return () => {
      if (Container.isMobile) {
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
  return Container.isMobile ? (
    <Kb.KeyboardAvoidingView2>
      {contents}
      <InputActionsBar operation={operation} />
    </Kb.KeyboardAvoidingView2>
  ) : (
    <Kb.Box2 direction="vertical" fullHeight={true} style={Constants.inputDesktopMaxHeight}>
      {contents}
    </Kb.Box2>
  )
}

export const DecryptOutput = () => {
  const content = (
    <>
      <SignedSender key="sender" operation={operation} />
      {Container.isMobile ? <Kb.Divider key="div" /> : null}
      <OperationOutput key="output" operation={operation} />
      <OutputActionsBar key="bar" operation={operation} />
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

export default DecryptInput
