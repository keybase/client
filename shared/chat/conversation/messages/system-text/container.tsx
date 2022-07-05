import * as Types from '../../../../constants/types/chat2'
import * as Container from '../../../../util/container'
import SystemText from '.'

type OwnProps = {
  message: Types.MessageSystemText
}

export default Container.connect(
  () => ({}),
  () => ({}),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(SystemText)
