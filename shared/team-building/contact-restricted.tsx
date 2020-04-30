import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'

type OwnProps = Container.RouteProps<Props>

type Props = {
  source: 'newFolder' | 'teamAddSomeFailed' | 'teamAddAllFailed' | 'walletsRequest' | 'misc'
  usernamesWithContactRestr?: Array<string>
  usernamesWithBrokenFollow?: Array<string>
}

export const ContactRestricted = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])
  let header = ''
  let description = ''
  let descriptionContactRestricted = ''
  let descriptionBrokenProofs = ''
  let contactRestrictedUsers: Array<string> = []
  let brokenFollowUsers: Array<string> = []
  let footerBtnLabel = 'Okay'
  const firstUser = props.usernamesWithContactRestr
    ? props.usernamesWithContactRestr[0]
      ? props.usernamesWithContactRestr[0]
      : undefined
    : undefined

  switch (props.source) {
    case 'walletsRequest':
      header = `You cannot request a payment from @${firstUser}.`
      description = `@${firstUser}'s contact restrictions prevent you from requesting a payment. Contact them outside Keybase to proceed.`
      break
    case 'newFolder':
      header = `You cannot open a private folder with @${firstUser}.`
      description = `@${firstUser}'s contact restrictions prevent you from opening a private folder with them. Contact them outside Keybase to proceed.`
      break
    case 'teamAddAllFailed': {
      const soloDisallowed = props.usernamesWithContactRestr?.length === 1
      if (!soloDisallowed) {
        // Show the disallowed group as a list
        contactRestrictedUsers = props.usernamesWithContactRestr ? props.usernamesWithContactRestr : []
      }
      header = soloDisallowed
        ? `You cannot add @${firstUser} to a team.`
        : 'These people could not be added to the team.'
      const prefix = soloDisallowed ? `@${firstUser}'s` : 'Their'
      description = `${prefix} contact restrictions prevent you from adding them. Contact them outside Keybase to proceed.`
      break
    }
    case 'teamAddSomeFailed':
      contactRestrictedUsers = props.usernamesWithContactRestr ? props.usernamesWithContactRestr : []
      brokenFollowUsers = props.usernamesWithBrokenFollow ? props.usernamesWithBrokenFollow : []
      header = 'These people could not be added to the team.'
      description = ''
      descriptionContactRestricted = 'Their contact restrictions prevent you from adding them to a team.'
      descriptionBrokenProofs = 'Their proofs changed since you last followed them.'
      footerBtnLabel = 'Continue anyway'
      break
  }
  return (
    <Kb.Modal
      //the navigation needs adjustment and evtensive testing
      onClose={onBack}
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
              type="Default"
              label={footerBtnLabel}
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
        <Kb.Icon type="iconfont-warning" sizeType="Huge" color={Styles.globalColors.black_20} />
        <Kb.Text center={true} style={styles.text} type="Header" lineClamp={2}>
          {header}
        </Kb.Text>
        {contactRestrictedUsers.length > 0 && (
          <Kb.Box2
            alignItems="center"
            direction="vertical"
            gap="small"
            gapStart={true}
            centerChildren={true}
            style={styles.card}
            noShrink={true}
          >
            {contactRestrictedUsers.map((username, idx) => (
              <Kb.ListItem2
                key={username}
                type={Styles.isMobile ? 'Large' : 'Small'}
                icon={<Kb.Avatar size={Styles.isMobile ? 48 : 32} username={username} />}
                firstItem={idx === 0}
                body={
                  <Kb.Box2 direction="vertical" fullWidth={true}>
                    <Kb.Text type="BodySemibold">{username}</Kb.Text>
                  </Kb.Box2>
                }
              />
            ))}
            <Kb.Text center={true} style={styles.text} type="BodyBig">
              {descriptionContactRestricted}
            </Kb.Text>
          </Kb.Box2>
        )}
        {brokenFollowUsers.length > 0 && (
          <Kb.Box2
            alignItems="center"
            direction="vertical"
            gap="small"
            gapStart={true}
            centerChildren={true}
            fullWidth={true}
            style={styles.card}
            noShrink={true}
          >
            {brokenFollowUsers.map((username, idx) => (
              <Kb.ListItem2
                key={username}
                type={Styles.isMobile ? 'Large' : 'Small'}
                icon={<Kb.Avatar size={Styles.isMobile ? 48 : 32} username={username} />}
                firstItem={idx === 0}
                body={
                  <Kb.Box2 direction="vertical" fullWidth={true}>
                    <Kb.Text type="BodySemibold">{username}</Kb.Text>
                  </Kb.Box2>
                }
              />
            ))}
            <Kb.Text center={true} style={styles.text} type="BodyBig">
              {descriptionBrokenProofs}
            </Kb.Text>
          </Kb.Box2>
        )}
        {description.length > 0 && (
          <Kb.Text center={true} style={styles.text} type="BodyBig">
            {description}
          </Kb.Text>
        )}
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  button: {
    flex: 1,
  },
  buttonBar: {
    marginBottom: Styles.globalMargins.medium,
    marginTop: Styles.globalMargins.small,
    minHeight: undefined,
  },
  card: {
    backgroundColor: Styles.globalColors.whiteOrBlack,
    borderColor: Styles.globalColors.black_10,
    borderStyle: 'solid',
    borderWidth: 1,
  },
  container: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blueGrey,
    },
    isElectron: {
      ...Styles.padding(0, Styles.globalMargins.medium),
      backgroundColor: Styles.globalColors.blueGrey,
      flex: 1,
    },
  }),
  icon: {
    marginBottom: Styles.globalMargins.medium,
    marginTop: Styles.globalMargins.xlarge,
  },
  text: {
    margin: Styles.globalMargins.small,
  },
}))

export default Container.connect(
  () => ({}),
  () => ({}),
  (_, __, ownProps: OwnProps) => {
    return {
      source: Container.getRouteProps(ownProps, 'source', 'misc'),
      usernamesWithBrokenFollow: Container.getRouteProps(ownProps, 'usernamesWithBrokenFollow', []),
      usernamesWithContactRestr: Container.getRouteProps(ownProps, 'usernamesWithContactRestr', []),
    }
  }
)(ContactRestricted)
