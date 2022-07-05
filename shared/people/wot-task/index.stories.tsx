import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {action} from '../../stories/storybook'
import {WotStatusType} from '../../constants/types/rpc-gen'
import WotTask from '.'

const baseProps = {
  key: '{voucher:alice,vouchee:bob}',
  onClickUser: action('onClickUser'),
  vouchee: 'bob',
  voucher: 'alice',
}

const propsProposed = {
  ...baseProps,
  status: WotStatusType.proposed,
}

const propsAccepted = {
  ...baseProps,
  status: WotStatusType.accepted,
}

const propsRejected = {
  ...baseProps,
  status: WotStatusType.rejected,
}

const load = () => {
  Sb.storiesOf('People/Wot Tasks', module)
    .add('proposed', () => <WotTask {...propsProposed} />)
    .add('accepted', () => <WotTask {...propsAccepted} />)
    .add('rejected', () => <WotTask {...propsRejected} />)
}

export default load
