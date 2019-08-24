import React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {
  onBack?: () => void
  onCancel: () => void
}

export const ExplodingExplainerElement = (props: Props) => (
  <Kb.MaybePopup onClose={props.onCancel}>
    <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={Styles.isMobile} style={styles.padding}>
      <Kb.Icon type="icon-message-exploding-260" />
      <Kb.Text center={true} style={styles.text} type="Body">
        Exploding messages use temporary "ephemeral keys”, which enhance the security of very short-lived
        messages. We explain why they work well with short messages&nbsp;
        <Kb.Text
          onClickURL="https://keybase.io/blog/keybase-exploding-messages"
          type="BodyPrimaryLink"
          style={styles.linkText}
          underline={true}
        >
          on our blog.
        </Kb.Text>
      </Kb.Text>
      <Kb.Text center={true} style={styles.text} type="Body">
        As a reminder, all messages - exploding or not - are end-to-end encrypted. Keybase servers never have
        the keys to read your chats or files.
      </Kb.Text>
      <Kb.Box style={styles.buttonBox}>
        <Kb.Button
          style={styles.button}
          onClick={props.onCancel}
          label="Got it"
          labelStyle={styles.labelText}
          fullWidth={Styles.isMobile}
        />
      </Kb.Box>
    </Kb.Box2>
  </Kb.MaybePopup>
)

const styles = Styles.styleSheetCreate({
  button: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      borderRadius: 20,
    },
    isElectron: {marginLeft: Styles.globalMargins.tiny},
    isMobile: {marginTop: Styles.globalMargins.tiny},
  }),
  buttonBox: Styles.platformStyles({
    common: {marginTop: Styles.globalMargins.xsmall},
    isElectron: {...Styles.globalStyles.flexBoxRow},
    isMobile: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'stretch',
      flex: 1,
      flexDirection: 'column-reverse',
      paddingTop: Styles.globalMargins.xlarge,
      width: '100%',
    },
  }),
  labelText: {
    color: Styles.globalColors.blueDark,
  },
  linkText: {
    color: Styles.globalColors.white,
  },
  padding: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blue,
      maxWidth: 560,
      padding: Styles.globalMargins.small,
    },
    isElectron: {
      borderRadius: 6,
      marginBottom: 40,
      marginLeft: 80,
      marginRight: 80,
      marginTop: 40,
      minHeight: 440,
    },
    isMobile: {
      flexGrow: 1,
      flexShrink: 1,
      maxHeight: '100%',
      paddingTop: Styles.globalMargins.xlarge,
    },
  }),
  text: {
    color: Styles.globalColors.white,
    paddingBottom: Styles.globalMargins.xsmall,
  },
})

export default Kb.HeaderOnMobile(ExplodingExplainerElement)
