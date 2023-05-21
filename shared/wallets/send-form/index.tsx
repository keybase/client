import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import Root from './root'
import SendBodyAdvanced from './body/advanced'
import {SendBody, RequestBody} from './body/container'

type OwnProps = {isAdvanced?: boolean}

export default (ownProps: OwnProps) => {
  const isAdvanced = ownProps.isAdvanced ?? false
  const isRequest = Container.useSelector(state => state.wallets.building.isRequest)
  const dispatch = Container.useDispatch()
  const onBack = isAdvanced
    ? () => dispatch(RouteTreeGen.createNavigateUp())
    : Container.isMobile
    ? () => dispatch(WalletsGen.createAbandonPayment())
    : undefined
  const onClose = () => {
    dispatch(WalletsGen.createAbandonPayment())
  }
  const props = {
    isAdvanced,
    isRequest,
    onBack,
    onClose,
  }
  return <SendRequestForm {...props} />
}

type Props = {
  isRequest: boolean
  isAdvanced: boolean
  onBack?: () => void
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
