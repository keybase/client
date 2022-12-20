import * as Constants from '../../../constants/crypto'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import openURL from '../../../util/open-url'
import {OutputInfoBanner} from '../../output'

const operation = Constants.Operations.Sign

export const SignOutputBanner = () => {
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
