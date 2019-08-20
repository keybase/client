import * as React from 'react'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
// import {isIOS} from '../../constants/platform'
import * as Styles from '../../styles'
// import * as TeamBuildingGen from '../../actions/team-building-gen'
import {ServiceIdWithContact, User} from 'constants/types/team-building'

type EmailInputProps = {
  search: (query: string, service: ServiceIdWithContact) => void
  onAddRaw: (user: User) => void
  teamBuildingSearchResults: {[query: string]: {[service in ServiceIdWithContact]: Array<User>}}
}

function checkValidEmail(str: string): boolean {
  const emailRegex = /^(\S+@\S+\.\S+)$/
  return str.length > 3 && emailRegex.test(str)
}

const EmailInput = (props: EmailInputProps) => {
  const {search, onAddRaw} = props
  const [isEmailValid, setEmailValidity] = React.useState(false)
  const [emailString, setEmailString] = React.useState('')
  const onChange = React.useCallback(
    text => {
      setEmailString(text)
      const isNewInputValid = checkValidEmail(text)
      if (isNewInputValid !== isEmailValid) {
        setEmailValidity(isNewInputValid)
      }
      if (isNewInputValid) {
        search(text, 'keybase')
      }
    },
    [isEmailValid, search]
  )

  const result =
    props.teamBuildingSearchResults[emailString] &&
    props.teamBuildingSearchResults[emailString].keybase &&
    props.teamBuildingSearchResults[emailString].keybase[0]
  let user: User | null = null
  if (result) {
    let serviceMap = props.teamBuildingSearchResults[emailString].keybase[0].serviceMap
    let username = props.teamBuildingSearchResults[emailString].keybase[0].serviceMap.keybase
    let prettyName = props.teamBuildingSearchResults[emailString].keybase[0].prettyName
    if (serviceMap && username && prettyName) {
      user = {
        id: username,
        prettyName,
        serviceId: 'keybase',
        serviceMap,
        username,
      }
    }
  }
  console.log('user:', user)

  const onSubmit = React.useCallback(() => {
    if (!user) return
    onAddRaw(user)
    // Clear input
    setEmailString('')
  }, [onAddRaw, user, setEmailString])

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
        {!!isEmailValid &&
          (user !== null ? (
            <Kb.NameWithIcon
              colorFollowing={true}
              horizontal={true}
              username={user.username}
              metaOne={user.prettyName}
              onClick={onSubmit}
            />
          ) : (
            <Kb.Box2 direction="horizontal" fullWidth={true}>
              <Kb.ProgressIndicator type="Small" />
            </Kb.Box2>
          ))}
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

const styles = Styles.styleSheetCreate({
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
})

export default EmailInput
