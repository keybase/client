import * as React from 'react'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as TeamBuildingGen from '../../actions/team-building-gen'
import {AllowedNamespace} from 'constants/types/team-building'

type EmailInputProps = {
  namespace: AllowedNamespace
}

function checkValidEmail(str: string): boolean {
  const emailRegex = /^(\S+@\S+\.\S+)$/
  return str.length > 3 && emailRegex.test(str)
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

  const onChange = React.useCallback(
    text => {
      setEmailString(text)
      const isNewInputValid = checkValidEmail(text)
      if (isNewInputValid !== isEmailValid) {
        setEmailValidity(isNewInputValid)
      }
      if (isNewInputValid) {
        dispatch(TeamBuildingGen.createSearchEmailAddress({namespace: namespace, query: text}))
      }
    },
    [isEmailValid, namespace, dispatch]
  )

  const onSubmit = React.useCallback(() => {
    if (!user) return

    dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({namespace, users: [user]}))
    // Clear input
    setEmailString('')
    setEmailValidity(false)
  }, [dispatch, user, setEmailString, setEmailValidity, namespace])

  return (
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.background}>
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
        <Kb.Box2
          fullWidth={true}
          alignItems="center"
          direction="horizontal"
          // style={Styles.collapseStyles([styles.phoneNumberContainer, styles.fakeInput])}
        >
          <Kb.PlainInput
            style={Styles.collapseStyles([styles.plainInput])}
            flexable={true}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="Email address"
            onChangeText={onChange}
            onEnterKeyDown={onSubmit}
            value={emailString}
          />
        </Kb.Box2>
        {isSearching && (
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <Kb.ProgressIndicator type="Small" />
          </Kb.Box2>
        )}
        {!isSearching && user !== null && user.serviceMap.keybase !== '' && emailString === user.username && (
          <Kb.NameWithIcon
            colorFollowing={true}
            horizontal={true}
            username={user.serviceMap.keybase}
            metaOne={user.prettyName}
            onClick={onSubmit}
            clickType="onClick"
          />
        )}
        {/* TODO: multiple email add support */}
        {/* <Kb.Text type="BodySmall" style={styles.subtext}> */}
        {/*   Pro tip: add multiple email addresses by separating them with commas. */}
        {/* </Kb.Text> */}
      </Kb.Box2>
      <Kb.Box2 direction="verticalReverse" fullWidth={true} style={styles.bottomContainer}>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Button label="Continue" fullWidth={true} onClick={onSubmit} disabled={!isEmailValid} />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  background: {
    backgroundColor: Styles.globalColors.blueGrey,
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    padding: Styles.globalMargins.small,
  },
  bottomContainer: {
    flexGrow: 1,
  },
  plainInput: Styles.platformStyles({
    common: {
      borderColor: Styles.globalColors.greyDark,
      borderRadius: 4,
      borderStyle: 'solid',
      borderWidth: 1,
    },
    isElectron: {
      ...Styles.padding(0, Styles.globalMargins.xsmall),
      height: 36,
    },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.small),
      height: 48,
    },
  }),
  subtext: {
    maxWidth: Styles.platformStyles({
      isElectron: {
        maxWidth: 300,
      },
      isMobile: {},
    }),
  },
}))

export default EmailInput
