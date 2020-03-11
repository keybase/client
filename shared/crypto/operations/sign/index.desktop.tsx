import * as React from 'react'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/crypto'
import * as Kb from '../../../common-adapters'
import openURL from '../../../util/open-url'
import {Input, DragAndDrop, OperationBanner} from '../../input'
import OperationOutput, {OutputBar, OutputInfoBanner, SignedSender} from '../../output'

const operation = Constants.Operations.Sign

const SignOutputBanner = () => {
  const outputType = Container.useSelector(state => state.crypto.sign.outputType)
  return (
    <OutputInfoBanner operation={operation}>
      <Kb.Text type="BodySmallSemibold" center={true}>
        This is your signed {outputType === 'file' ? 'file' : 'message'}, using{` `}
        <Kb.Text
          type="BodySecondaryLink"
          underline={true}
          onClick={() => openURL(Constants.saltpackDocumentation)}
        >
          Saltpack
        </Kb.Text>
        .{` `}Anyone who has it can verify you signed it.
      </Kb.Text>
    </OutputInfoBanner>
  )
}

export const SignInput = () => (
  <>
    <OperationBanner
      operation={operation}
      infoMessage="Add your cryptographic signature to a message or file."
    />
    <Input operation={operation} />
  </>
)

export const SignOutput = () => (
  <>
    <SignOutputBanner />
    <SignedSender operation={operation} />
    <OperationOutput operation={operation} />
    <OutputBar operation={operation} />
  </>
)

const Sign = () => {
  return (
    <DragAndDrop operation={operation} prompt="Drop a file to sign">
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <SignInput />
        <SignOutput />
      </Kb.Box2>
    </DragAndDrop>
  )
}

export default Sign
