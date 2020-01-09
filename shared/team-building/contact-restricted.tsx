import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'

type OwnProps = Container.RouteProps<Props>

type Props = {
  source: 'newFolder' | 'teamAddSomeFailed' | 'teamAddAllFailed' | 'walletsRequest' | 'misc'
  usernames: Array<string>
}

const ContactRestricted = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])
  let header = ''
  let description = ''
  switch (props.source) {
    case 'walletsRequest':
      header = 'The following people cannot be added to the conversation:'
      description = `@${props.usernames[0]}'s contact restrictions prevent you from requesting a payment. Contact them outside Keybase to proceed.`
  }
  return (
    <Kb.Modal
      onClose={onBack}
      mode="Wide"
      header={
        Styles.isMobile
          ? {
              leftButton: <Kb.BackButton onClick={onBack} />,
            }
          : undefined
      }
      footer={{
        content: (
          <Kb.ButtonBar direction="row" fullWidth={true} style={styles.buttonBar}>
            <Kb.WaitingButton
              key="okay"
              type="Success"
              label="Okay"
              onClick={onBack}
              style={styles.button}
              waitingKey={null}
            />
          </Kb.ButtonBar>
        ),
        hideBorder: true,
      }}
    >
      <Kb.Box2
        alignItems="center"
        direction="vertical"
        gap="small"
        gapStart={true}
        centerChildren={true}
        fullWidth={true}
        style={styles.container}
        noShrink={true}
      >
        <Kb.Icon type="iconfont-warning" sizeType="Huge" color={Styles.globalColors.black_50} />
        <Kb.Text center={true} style={styles.text} type="HeaderBig" lineClamp={2}>
          {header}
        </Kb.Text>
        <Kb.Text center={true} style={styles.text} type="Body">
          {description}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  button: {
    flex: 1,
  },
  buttonBar: {
    minHeight: undefined,
  },
  container: Styles.platformStyles({
    isElectron: {
      ...Styles.padding(0, Styles.globalMargins.xlarge),
      flex: 1,
    },
  }),
  icon: {
    marginBottom: Styles.globalMargins.large,
    marginTop: Styles.globalMargins.large,
  },
  text: {
    color: Styles.globalColors.black,
    margin: Styles.globalMargins.small,
  },
}))

export default Container.connect(
  () => ({}),
  () => ({}),
  (_, __, ownProps: OwnProps) => ({
    source: Container.getRouteProps(ownProps, 'source', 'misc'),
    usernames: Container.getRouteProps(ownProps, 'usernames', []),
  })
)(ContactRestricted)
