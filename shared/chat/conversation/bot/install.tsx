import * as React from 'react'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

type Props = Container.RouteProps<{botUsername: string; name: string}>

const BotPopup = (props: Props) => {}

type DescribeBotProps = {
  botUsername: string
  name: string
}

const DescribeBot = (props: Props) => {
  const botUsername = Container.getRouteProps(props, 'botUsername', '')
  const name = Container.getRouteProps(props, 'name', '')

  // dispatch
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  return (
    <Kb.Modal
      header={{
        leftButton: (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            Cancel
          </Kb.Text>
        ),
        title: '',
      }}
      footer={{
        content: (
          <Kb.Button
            fullWidth={true}
            label="Install (free)"
            onClick={() => {}}
            mode="Primary"
            type="Default"
          />
        ),
      }}
    >
      <Kb.Text type="BodyBig">{botUsername}</Kb.Text>
    </Kb.Modal>
  )
}

export default InstallBot
