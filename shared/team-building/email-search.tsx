import * as C from '@/constants'
import * as TB from '@/stores/team-building'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {validateEmailAddress} from '@/util/email-address'
import {UserMatchMention} from './phone-search'
import ContinueButton from './continue-button'
import {searchWaitingKey} from '@/constants/strings'

type EmailSearchProps = {
  continueLabel: string
  namespace: T.TB.AllowedNamespace
  search: (query: string, service: 'email') => void
}

const EmailSearch = ({continueLabel, namespace, search}: EmailSearchProps) => {
  const teamBuildingSearchResults = TB.useTBContext(s => s.searchResults)
  const [isEmailValid, setEmailValidity] = React.useState(false)
  const [emailString, setEmailString] = React.useState('')
  const waiting = C.Waiting.useAnyWaiting(searchWaitingKey)
  const user: T.TB.User | undefined = teamBuildingSearchResults.get(emailString)?.get('email')?.[0]
  const canSubmit = !!user && !waiting && isEmailValid

  const onChange = React.useCallback(
    (_text: string) => {
      // Remove leading or trailing whitespace
      const text = _text.trim()
      setEmailString(text)
      const valid = validateEmailAddress(text)
      setEmailValidity(valid)
      if (valid) {
        search(text, 'email')
      }
    },
    [search]
  )

  const addUsersToTeamSoFar = TB.useTBContext(s => s.dispatch.addUsersToTeamSoFar)

  const onSubmit = React.useCallback(() => {
    if (!user || !canSubmit) {
      return
    }
    addUsersToTeamSoFar([user])
    // Clear input
    onChange('')
  }, [addUsersToTeamSoFar, canSubmit, user, onChange])

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
            centerChildren={!Kb.Styles.isMobile}
            direction="vertical"
            fullWidth={true}
            gap="tiny"
            style={styles.emptyContainer}
          >
            {!Kb.Styles.isMobile && (
              <Kb.Icon color={Kb.Styles.globalColors.black_20} fontSize={48} type="iconfont-mention" />
            )}
            {namespace === 'chat2' ? (
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      background: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.blueGrey,
          flex: 1,
          padding: Kb.Styles.globalMargins.small,
        },
        isMobile: {
          zIndex: -1,
        },
      }),
      bottomContainer: {
        flexGrow: 1,
      },
      emptyContainer: Kb.Styles.platformStyles({
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
      helperText: Kb.Styles.platformStyles({
        common: {textAlign: 'center'},
        isMobile: {
          paddingBottom: Kb.Styles.globalMargins.small,
          paddingTop: Kb.Styles.globalMargins.small,
        },
      }),
      input: Kb.Styles.platformStyles({
        common: {},
        isElectron: {
          ...Kb.Styles.padding(0, Kb.Styles.globalMargins.xsmall),
          height: 38,
        },
        isMobile: {
          ...Kb.Styles.padding(0, Kb.Styles.globalMargins.small),
          height: 48,
        },
      }),
      userMatchMention: {
        alignSelf: 'flex-start',
        marginLeft: Kb.Styles.globalMargins.small,
      },
    }) as const
)

export default EmailSearch
