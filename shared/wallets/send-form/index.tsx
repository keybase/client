import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Root from './root'
import {SendBody, RequestBody} from './body/container'
import SendBodyAdvanced from './body/advanced'

type Props = {
  isRequest: boolean
  isAdvanced: boolean
  onBack: (() => void) | null
  onClose: () => void
}

const SendRequestForm = (props: Props) => (
  <Root
    isRequest={props.isRequest}
    onBack={props.onBack}
    onClose={props.onClose}
    showCancelInsteadOfBackOnMobile={!props.isAdvanced}
  >
    {props.isAdvanced ? (
      props.isRequest ? (
        <Kb.Text type="HeaderBig">Developer Error</Kb.Text>
      ) : (
        <SendBodyAdvanced />
      )
    ) : props.isRequest ? (
      <RequestBody />
    ) : (
      <SendBody />
    )}
  </Root>
)
SendRequestForm.navigationOptions = {
  safeAreaStyle: {
    backgroundColor: Styles.globalColors.purpleDark,
  },
}

export default SendRequestForm
