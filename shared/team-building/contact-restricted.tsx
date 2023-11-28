import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Container from '@/util/container'

type Props = {
  source: 'newFolder' | 'teamAddSomeFailed' | 'teamAddAllFailed' | 'misc'
  usernames: Array<string>
}

export const ContactRestricted = (props: Props) => {
  const nav = Container.useSafeNavigation()
  const onBack = React.useCallback(() => nav.safeNavigateUp(), [nav])
  let header = ''
  let description = ''
  let disallowedUsers: Array<string> = []
  const firstUser = props.usernames[0]
  switch (props.source) {
    case 'newFolder':
      header = `You cannot open a private folder with @${firstUser}.`
      description = `@${firstUser}'s contact restrictions prevent you from opening a private folder with them. Contact them outside Keybase to proceed.`
      break
    case 'teamAddAllFailed': {
      const soloDisallowed = props.usernames.length === 1
      if (!soloDisallowed) {
        // Show the disallowed group as a list
        disallowedUsers = props.usernames
      }
      header = soloDisallowed
        ? `You cannot add @${firstUser} to a team.`
        : 'The following people could not be added to the team.'
      const prefix = soloDisallowed ? `@${firstUser}'s` : 'Their'
      description = `${prefix} contact restrictions prevent you from adding them. Contact them outside Keybase to proceed.`
      break
    }
    case 'teamAddSomeFailed':
      disallowedUsers = props.usernames
      header = 'Some of the users could not be added to the team.'
      description =
        'Their contact restrictions prevent you from adding them. Contact them outside Keybase to proceed.'
      break
    default:
  }
  return (
    <Kb.Modal
      onClose={onBack}
      header={
        Kb.Styles.isMobile
          ? {
              leftButton: <Kb.BackButton onClick={onBack} />,
            }
          : undefined
      }
      footer={{
        content: (
          <Kb.ButtonBar direction="row" fullWidth={true} style={styles.buttonBar}>
            <Kb.WaitingButton type="Default" label="Okay" onClick={onBack} style={styles.button} />
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
        <Kb.Icon type="iconfont-warning" sizeType="Huge" color={Kb.Styles.globalColors.black_20} />
        <Kb.Text center={true} style={styles.text} type="Header" lineClamp={2}>
          {header}
        </Kb.Text>
        {disallowedUsers.length > 0 && (
          <>
            {disallowedUsers.map((username, idx) => (
              <Kb.ListItem2
                key={username}
                type={Kb.Styles.isMobile ? 'Large' : 'Small'}
                icon={<Kb.Avatar size={Kb.Styles.isMobile ? 48 : 32} username={username} />}
                firstItem={idx === 0}
                body={
                  <Kb.Box2 direction="vertical" fullWidth={true}>
                    <Kb.Text type="BodySemibold">{username}</Kb.Text>
                  </Kb.Box2>
                }
              />
            ))}
          </>
        )}
        <Kb.Text center={true} style={styles.text} type="BodyBig">
          {description}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  button: {
    flex: 1,
  },
  buttonBar: {
    marginBottom: Kb.Styles.globalMargins.medium,
    marginTop: Kb.Styles.globalMargins.small,
    minHeight: undefined,
  },
  container: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.padding(0, Kb.Styles.globalMargins.medium),
      flex: 1,
    },
  }),
  icon: {
    marginBottom: Kb.Styles.globalMargins.medium,
    marginTop: Kb.Styles.globalMargins.xlarge,
  },
  text: {
    margin: Kb.Styles.globalMargins.small,
  },
}))

const ContactContainer = (ownProps: Props) => {
  const props = {
    source: ownProps.source,
    usernames: ownProps.usernames,
  }
  return <ContactRestricted {...props} />
}

export default ContactContainer
