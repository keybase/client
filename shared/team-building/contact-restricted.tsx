import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as TeamsGen from '../actions/teams-gen'
import flags from '../util/feature-flags'

type OwnProps = Container.RouteProps<Props>

type Props = {
  source: 'newFolder' | 'teamAddSomeFailed' | 'teamAddAllFailed' | 'walletsRequest' | 'misc'
  usernamesWithContactRestr?: Array<string>
  usernamesWithBrokenFollow?: Array<string>
}

export const ContactRestricted = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onNavUp = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])
  const onFinishTeamWizard = () => dispatch(TeamsGen.createFinishedAddMembersWizard())
  let onBack = onNavUp
  let header = ''
  let description = ''
  let descriptionContactRestricted = ''
  const descriptionBrokenProofs = 'Their proofs changed since you last followed them.'
  let contactRestrictedUsers: Array<string> = []
  let brokenFollowUsers: Array<string> = []
  let footerBtnLabel = 'Okay'
  let showBack = true
  const firstUser = props.usernamesWithContactRestr
    ? props.usernamesWithContactRestr[0]
      ? props.usernamesWithContactRestr[0]
      : undefined
    : undefined

  switch (props.source) {
    case 'walletsRequest':
      header = `You cannot request a payment from @${firstUser}.`
      description = `@${firstUser}'s contact restrictions prevent you from requesting a payment. Contact them outside Keybase to proceed.`
      descriptionContactRestricted = 'Their contact restrictions prevent you from starting a chat with them.'
      break
    case 'newFolder':
      header = `You cannot open a private folder with @${firstUser}.`
      description = `@${firstUser}'s contact restrictions prevent you from opening a private folder with them. Contact them outside Keybase to proceed.`
      descriptionContactRestricted = 'Their contact restrictions prevent you from starting a chat with them.'
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
      descriptionContactRestricted = 'Their contact restrictions prevent you from adding them to a team.'
      if (flags.teamsRedesign) {
        onBack = onFinishTeamWizard
        showBack = false
      }
      break
    }
    case 'teamAddSomeFailed':
      contactRestrictedUsers = props.usernamesWithContactRestr ?? []
      brokenFollowUsers = props.usernamesWithBrokenFollow ?? []
      header = 'These people could not be added to the team.'
      description = ''
      descriptionContactRestricted = 'Their contact restrictions prevent you from adding them to a team.'
      footerBtnLabel = 'Continue anyway'
      if (flags.teamsRedesign) {
        onBack = onFinishTeamWizard
        showBack = false
      }
      break
  }
  return (
    <Kb.Modal
      onClose={onBack}
      header={
        Styles.isMobile && showBack
          ? {
              leftButton: <Kb.BackButton onClick={onBack} />,
            }
          : undefined
      }
      footer={{
        content: (
          <Kb.WaitingButton
            type="Default"
            label={footerBtnLabel}
            onClick={onBack}
            style={styles.button}
            waitingKey={null}
            fullWidth={true}
          />
        ),
        hideBorder: true,
      }}
      backgroundStyle={styles.bg}
      mode="DefaultFullHeight"
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
            <Kb.Text style={styles.text} type="BodyBig">
              {descriptionContactRestricted}
            </Kb.Text>
          </Kb.Box2>
        )}
        {brokenFollowUsers.length > 0 && (
          <Kb.Box2
            alignItems="center"
            direction="vertical"
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
            <Kb.Text style={styles.text} type="BodyBig">
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
  bg: {backgroundColor: Styles.globalColors.blueGrey},
  button: {
    flex: 1,
  },
  buttonBar: {
    marginBottom: Styles.globalMargins.medium,
    marginTop: Styles.globalMargins.small,
    minHeight: undefined,
  },
  card: {
    borderColor: Styles.globalColors.black_10,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    paddingTop: Styles.globalMargins.tiny,
  },
  container: {
    ...Styles.padding(0, Styles.globalMargins.medium),
  },
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
