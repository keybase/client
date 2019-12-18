import * as React from 'react'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
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
  const {featured, inOrigin} = Container.useSelector(state => ({
    featured: state.chat2.featuredBotsMap.get(botUsername),
    inOrigin: origin && (!origin.isTeam || TeamTypes.userInTeam(state, origin.name, botUsername)),
  }))
  // dispatch
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  // merge
  const showInstallButton = !origin || !inOrigin

  const featuredContent = !!featured && (
    <Kb.Box2 direction="vertical" gap="small" style={styles.container} fullWidth={true}>
      <Kb.Box2 direction="horizontal" gap="small" fullWidth={true}>
        <Kb.Avatar username={botUsername} size={64} />
        <Kb.Box2 direction="vertical">
          <Kb.Text type="BodyBigExtrabold">{featured.botAlias}</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Text type="Body">{featured.description}</Kb.Text>
    </Kb.Box2>
  )
  const usernameContent = null
  const content = featured ? featuredContent : usernameContent
  return (
    <Kb.Modal
      header={{
        leftButton: (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            {!showInstallButton ? 'Close' : 'Cancel'}
          </Kb.Text>
        ),
        title: '',
      }}
      footer={
        showInstallButton
          ? {
              content: (
                <Kb.Button
                  fullWidth={true}
                  label="Install (free)"
                  onClick={() => {}}
                  mode="Primary"
                  type="Default"
                />
              ),
            }
          : undefined
      }
    >
      {content}
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.padding(Styles.globalMargins.medium, Styles.globalMargins.small),
  },
}))

export default InstallBotPopup
