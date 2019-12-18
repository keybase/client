import * as React from 'react'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as TeamTypes from '../../../constants/teams'

type Origin = {
  name: string
  isTeam: boolean
}

type Props = Container.RouteProps<{botUsername: string; origin?: Origin}>

const InstallBotPopup = (props: Props) => {
  const botUsername = Container.getRouteProps(props, 'botUsername', '')
  const origin = Container.getRouteProps(props, 'origin', undefined)

  // state
  const {inOrigin} = Container.useSelector(state => ({
    inOrigin: origin && (!origin.isTeam || TeamTypes.userInTeam(state, origin.name, botUsername)),
  }))
  // dispatch
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  // merge
  const showInstallButton = !origin || inOrigin

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
        content: showInstallButton ? (
          <Kb.Button
            fullWidth={true}
            label="Install (free)"
            onClick={() => {}}
            mode="Primary"
            type="Default"
          />
        ) : null,
      }}
    >
      <Kb.Text type="BodyBig">{botUsername}</Kb.Text>
    </Kb.Modal>
  )
}

export default InstallBotPopup
