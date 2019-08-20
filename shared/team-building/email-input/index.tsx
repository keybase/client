import * as React from 'react'
import * as Kb from '../../common-adapters'
import {isIOS} from '../../constants/platform'
import * as Styles from '../../styles'

type EmailInputProps = {
  onSubmitEmail: () => void
}

const EmailInput = (props: EmailInputProps) => {
  return (
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.background} gap="tiny">
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Box2
          fullWidth={true}
          alignItems="center"
          direction="horizontal"
          // style={Styles.collapseStyles([styles.phoneNumberContainer, styles.fakeInput])}
        >
          <Kb.PlainInput
            style={Styles.collapseStyles([styles.plainInput])}
            flexable={true}
            keyboardType={isIOS ? 'number-pad' : 'numeric'}
            placeholder="Email address"
            onChangeText={text => console.log(text)}
            onEnterKeyDown={props.onSubmitEmail}
            // value={this.state.formatted}
            // disabled={this.state.country === ''}
            textContentType="emailAddress"
          />
        </Kb.Box2>
        <Kb.Text type="BodySmall" style={styles.subtext}>
          Pro tip: add multiple email addresses by separating them with commas.
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="verticalReverse" fullWidth={true} style={styles.bottomContainer}>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Button label="Continue" fullWidth={true} onClick={props.onSubmitEmail} />
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
