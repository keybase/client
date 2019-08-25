import * as React from 'react'
import {debounce} from 'lodash-es'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as TeamBuildingGen from '../../actions/team-building-gen'
import {AllowedNamespace} from '../../constants/types/team-building'
import {validateEmailAddress} from '../../util/email-address'
import Flags from '../../util/feature-flags'

type EmailInputProps = {
  namespace: AllowedNamespace
}

const EmailInput = ({namespace}: EmailInputProps) => {
  const [isEmailValid, setEmailValidity] = React.useState(false)
  const [emailString, setEmailString] = React.useState('')
  const dispatch = Container.useDispatch()
  const user = Container.useSelector(state => {
    return state[namespace].teamBuilding.teamBuildingEmailResult
  })
  const isSearching = Container.useSelector(
    state => state[namespace].teamBuilding.teamBuildingEmailIsSearching
  )
  const canSubmit = user !== null && !isSearching && isEmailValid
  const emailHasKeybaseAccount =
    user !== null && user.serviceMap.keybase !== '' && emailString === user.username

  const debouncedSearch = React.useCallback(
    debounce((query: string) => dispatch(TeamBuildingGen.createSearchEmailAddress({namespace, query})), 200),
    [dispatch, namespace]
  )

  const onChange = React.useCallback(
    text => {
      setEmailString(text)
      const isNewInputValid = validateEmailAddress(text)
      if (isNewInputValid !== isEmailValid) {
        setEmailValidity(isNewInputValid)
      }
      if (isNewInputValid) {
        debouncedSearch(text)
      }
    },
    [isEmailValid, debouncedSearch]
  )

  const onSubmit = React.useCallback(() => {
    if (user === null || !canSubmit) {
      return
    }

    dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({namespace, users: [user]}))
    // Clear input
    onChange('')
  }, [dispatch, canSubmit, user, namespace, onChange])

  return (
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.background}>
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
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
        {isSearching && (
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <Kb.ProgressIndicator type="Small" />
          </Kb.Box2>
        )}
        {user !== null && canSubmit && emailHasKeybaseAccount && (
          <Kb.NameWithIcon
            colorFollowing={true}
            horizontal={true}
            username={user.serviceMap.keybase}
            metaOne={user.prettyName}
            onClick={onSubmit}
            clickType="onClick"
          />
        )}
        {/* TODO: add support for multiple emails  */}
      </Kb.Box2>
      <Kb.Box2 direction="verticalReverse" fullWidth={true} style={styles.bottomContainer}>
        <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true}>
          <Kb.Button
            label={Flags.wonderland ? 'Continue 🐇' : 'Continue'}
            fullWidth={true}
            onClick={onSubmit}
            disabled={!canSubmit}
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
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
}))

export default EmailInput
