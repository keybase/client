import * as C from '@/constants'
import * as Crypto from '@/stores/crypto'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import openURL from '@/util/open-url'
import {Input, DragAndDrop, OperationBanner, InputActionsBar} from '../input'
import {OutputInfoBanner, OperationOutput, OutputActionsBar, SignedSender} from '../output'

const operation = Crypto.Operations.Sign

const SignOutputBanner = () => {
  const outputType = Crypto.useCryptoState(s => s.sign.outputType)
  return (
    <OutputInfoBanner operation={operation}>
      <Kb.Text type="BodySmallSemibold" center={true}>
        This is your signed {outputType === 'file' ? 'file' : 'message'}, using{` `}
        <Kb.Text
          type="BodySecondaryLink"
          underline={true}
          onClick={() => openURL(Crypto.saltpackDocumentation)}
        >
          Saltpack
        </Kb.Text>
        .{` `}Anyone who has it can verify you signed it.
      </Kb.Text>
    </OutputInfoBanner>
  )
}

export const SignInput = () => {
  const blurCBRef = React.useRef(() => {})
  const setBlurCB = React.useCallback((cb: () => void) => {
    blurCBRef.current = cb
  }, [])

  const resetOperation = Crypto.useCryptoState(s => s.dispatch.resetOperation)
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
      <Input operation={operation} setBlurCB={setBlurCB} />
      {C.isMobile ? <InputActionsBar operation={operation} blurCBRef={blurCBRef} /> : null}
    </>
  )

  return C.isMobile ? (
    <Kb.KeyboardAvoidingView2>{content}</Kb.KeyboardAvoidingView2>
  ) : (
    <Kb.Box2 direction="vertical" fullHeight={true} style={Crypto.inputDesktopMaxHeight}>
      {content}
    </Kb.Box2>
  )
}

export const SignOutput = () => {
  const content = (
    <>
      <SignOutputBanner />
      <SignedSender operation={operation} />
      {C.isMobile ? <Kb.Divider /> : null}
      <OperationOutput operation={operation} />
      <OutputActionsBar operation={operation} />
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

export const SignIO = () => {
  return (
    <DragAndDrop operation={operation} prompt="Drop a file to sign">
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <SignInput />
        <SignOutput />
      </Kb.Box2>
    </DragAndDrop>
  )
}
