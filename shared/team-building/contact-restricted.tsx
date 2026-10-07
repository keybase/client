import * as Kb from '@/common-adapters'
import {useSafeNavigation} from '@/util/safe-navigation'

type Props = {
  source: 'newFolder' | 'teamAddSomeFailed' | 'teamAddAllFailed' | 'misc'
  usernames: Array<string>
}

export const ContactRestricted = (props: Props) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const nav = useSafeNavigation()
  const onBack = () => nav.safeNavigateUp()
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
    <Kb.ModalScreen
      centered={true}
      footer={<Kb.Button type="Default" label="Okay" onClick={onBack} fullWidth={true} />}
    >
      <Kb.Box2 alignItems="center" direction="vertical" gap="small" fullWidth={true} style={styles.container}>
        <Kb.Icon type="iconfont-warning" sizeType="Huge" color={theme.black_20} />
        <Kb.Text center={true} type="BodyBig">
          {header}
        </Kb.Text>
        {disallowedUsers.length > 0 && (
          <Kb.Box2 direction="vertical" fullWidth={true}>
            {disallowedUsers.map((username, idx) => (
              <Kb.ListItem
                key={username}
                type={isMobile ? 'Large' : 'Small'}
                icon={<Kb.Avatar size={isMobile ? 48 : 32} username={username} />}
                firstItem={idx === 0}
                body={<Kb.Text type="BodySemibold">{username}</Kb.Text>}
              />
            ))}
          </Kb.Box2>
        )}
        <Kb.Text center={true} type="Body">
          {description}
        </Kb.Text>
      </Kb.Box2>
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  container: {paddingTop: Kb.Styles.globalMargins.small},
}))

export default ContactRestricted
