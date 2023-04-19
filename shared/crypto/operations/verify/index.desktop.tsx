import * as Constants from '../../../constants/crypto'
import * as Kb from '../../../common-adapters'
import {Input, DragAndDrop, OperationBanner} from '../../input'
import {OperationOutput, SignedSender, OutputActionsBar} from '../../output'

const operation = Constants.Operations.Verify

export const VerifyInput = () => (
  <Kb.Box2 direction="vertical" fullHeight={true} style={Constants.inputDesktopMaxHeight}>
    <OperationBanner operation={operation} />
    <Input operation={operation} />
  </Kb.Box2>
)
export const VerifyOutput = () => (
  <Kb.Box2 direction="vertical" fullHeight={true} style={Constants.outputDesktopMaxHeight}>
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
