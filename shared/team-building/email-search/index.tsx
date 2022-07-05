import * as React from 'react'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as TeamBuildingGen from '../../actions/team-building-gen'
import * as Constants from '../../constants/team-building'
import * as Types from '../../constants/types/team-building'
import {AllowedNamespace} from '../../constants/types/team-building'
import {validateEmailAddress} from '../../util/email-address'
import {UserMatchMention} from '../phone-search'
import ContinueButton from '../continue-button'

type EmailSearchProps = {
  continueLabel: string
  namespace: AllowedNamespace
  search: (query: string, service: 'email') => void
  teamBuildingSearchResults: Types.SearchResults
}

const EmailSearch = ({continueLabel, namespace, search, teamBuildingSearchResults}: EmailSearchProps) => {
  const [isEmailValid, setEmailValidity] = React.useState(false)
  const [emailString, setEmailString] = React.useState('')
  const waiting = Container.useAnyWaiting(Constants.searchWaitingKey)
  const dispatch = Container.useDispatch()

  const user: Types.User | undefined = teamBuildingSearchResults.get(emailString)?.get('email')?.[0]
  const canSubmit = !!user && !waiting && isEmailValid

  const onChange = React.useCallback(
    text => {
      // Remove leading or trailing whitespace
      text = text.trim()
      setEmailString(text)
      const valid = validateEmailAddress(text)
      setEmailValidity(valid)
      if (valid) {
        search(text, 'email')
      }
    },
    [search]
  )

  const onSubmit = React.useCallback(() => {
    if (!user || !canSubmit) {
      return
    }

    dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({namespace, users: [user]}))
    // Clear input
    onChange('')
  }, [dispatch, canSubmit, user, namespace, onChange])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.background}>
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.flexGrow}>
        <Kb.NewInput
          autoFocus={true}
          containerStyle={styles.input}
          keyboardType="email-address"
          placeholder="Email address"
          onChangeText={onChange}
          onEnterKeyDown={onSubmit}
          textContentType="emailAddress"
          value={emailString}
        />
        {waiting && (
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <Kb.ProgressIndicator type="Small" />
          </Kb.Box2>
        )}
        {!!user && canSubmit && !!user.serviceMap.keybase ? (
          <UserMatchMention username={user.serviceMap.keybase} />
        ) : (
          <Kb.Box2
            alignSelf="center"
            centerChildren={!Styles.isMobile}
            direction="vertical"
            fullWidth={true}
            gap="tiny"
            style={styles.emptyContainer}
          >
            {!Styles.isMobile && (
              <Kb.Icon color={Styles.globalColors.black_20} fontSize={48} type="iconfont-mention" />
            )}
            {namespace == 'chat2' ? (
              <Kb.Text type="BodySmall" style={styles.helperText}>
                Start a chat with any email contact, then tell them to install Keybase. Your messages will
                unlock after they sign up.
              </Kb.Text>
            ) : (
              <Kb.Text type="BodySmall" style={styles.helperText}>
                Add any email contact, then tell them to install Keybase. They will automatically join the
                team after they sign up.
              </Kb.Text>
            )}
          </Kb.Box2>
        )}
        {/* TODO: add support for multiple emails  */}
      </Kb.Box2>
      <ContinueButton label={continueLabel} onClick={onSubmit} disabled={!canSubmit} />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      background: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.blueGrey,
          flex: 1,
          padding: Styles.globalMargins.small,
        },
        isMobile: {
          zIndex: -1,
        },
      }),
      bottomContainer: {
        flexGrow: 1,
      },
      emptyContainer: Styles.platformStyles({
        common: {flex: 1},
        isElectron: {
          maxWidth: 290,
          paddingBottom: 40,
        },
        isMobile: {maxWidth: '90%'},
      }),
      flexGrow: {
        flex: 1,
      },
      helperText: Styles.platformStyles({
        common: {textAlign: 'center'},
        isMobile: {
          paddingBottom: Styles.globalMargins.small,
          paddingTop: Styles.globalMargins.small,
        },
      }),
      input: Styles.platformStyles({
        common: {},
        isElectron: {
          ...Styles.padding(0, Styles.globalMargins.xsmall),
          height: 38,
        },
        isMobile: {
          ...Styles.padding(0, Styles.globalMargins.small),
          height: 48,
        },
      }),
      userMatchMention: {
        alignSelf: 'flex-start',
        marginLeft: Styles.globalMargins.small,
      },
    } as const)
)

export default EmailSearch
