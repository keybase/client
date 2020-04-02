import * as React from 'react'
import {WebOfTrustVerificationType} from '../../constants/types/more'
import * as Constants from '../../constants/profile'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  error?: string
  onSubmit: () => void
  voucheeUsername: string
}

type WotModalProps = {
  error?: string
  submitLabel: string
  onSubmit: () => void
  children: React.ReactNode
}

// PICNIC-1059 Keep in sync with server limit (yet to be implemented)
const statementLimit = 700

const WotModal = (props: WotModalProps) => {
  return (
    <Kb.Modal
      header={{title: 'Web of Trust'}}
      mode="DefaultFullHeight"
      banners={[
        !!props.error && (
          <Kb.Banner color="red">
            <Kb.BannerParagraph bannerColor="red" content={props.error} />
          </Kb.Banner>
        ),
      ]}
      footer={{
        content: (
          <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
            <Kb.Button fullWidth={true} label={props.submitLabel} onClick={props.onSubmit} />
          </Kb.ButtonBar>
        ),
      }}
    >
      <Kb.Box2
        direction="vertical"
        alignSelf="stretch"
        alignItems="stretch"
        style={{backgroundColor: Styles.globalColors.green}}
      >
        <Kb.Icon type="icon-illustration-wot-460-96" />
      </Kb.Box2>
      {props.children}
    </Kb.Modal>
  )
}

export const Question1 = (props: Props) => {
  return (
    <WotModal error={props.error} submitLabel="Continue" onSubmit={props.onSubmit}>
      <Kb.Box2
        direction="horizontal"
        alignSelf="stretch"
        alignItems="center"
        style={Styles.collapseStyles([styles.sidePadding, styles.id])}
      >
        <Kb.Avatar username={props.voucheeUsername} size={48} />
        <Kb.Text type="BodySemibold" style={styles.idInner}>
          How do you know{' '}
          <Kb.ConnectedUsernames
            usernames={props.voucheeUsername}
            type="BodySemibold"
            inline={true}
            colorFollowing={true}
            colorBroken={true}
          />{' '}
          is the person you think they are?
        </Kb.Text>
      </Kb.Box2>
      {Constants.choosableWotVerificationTypes.map(vt => (
        <VerificationChoice
          key={vt}
          voucheeUsername={props.voucheeUsername}
          verificationType={vt}
          selected={false}
          onSelect={() => {}}
        />
      ))}
    </WotModal>
  )
}

export const Question2 = (props: Props) => {
  return (
    <WotModal error={props.error} submitLabel="Submit" onSubmit={props.onSubmit}>
      <Kb.Box2
        direction="vertical"
        alignSelf="stretch"
        alignItems="stretch"
        style={Styles.collapseStyles([styles.sidePadding, styles.outside])}
      >
        <Kb.Box2 direction="horizontal" alignItems="center" style={styles.outsideBox}>
          <Kb.Avatar username={props.voucheeUsername} size={48} />
          <Kb.Text type="BodySemibold" style={styles.idInner}>
            How do you know{' '}
            <Kb.ConnectedUsernames
              usernames={props.voucheeUsername}
              type="BodySemibold"
              inline={true}
              colorFollowing={true}
              colorBroken={true}
            />{' '}
            outside of Keybase?
          </Kb.Text>
        </Kb.Box2>
        <Kb.LabeledInput
          placeholder="Your claim"
          hoverPlaceholder={'Write how you met them and what experiences you shared with them.'}
          multiline={true}
          rowsMin={9}
          autoFocus={true}
          maxLength={statementLimit}
        />
        <Kb.Text type="BodySmall" style={styles.approveNote}>
          {props.voucheeUsername} will be able to approve or suggest edits to what you’ve written.
        </Kb.Text>
      </Kb.Box2>
    </WotModal>
  )
}

const VerificationChoice = (props: {
  voucheeUsername: string
  verificationType: WebOfTrustVerificationType
  selected: boolean
  onSelect: () => void
}) => {
  let text: React.ReactNode = 'Do not choose this option'
  let color: string = Styles.globalColors.white
  switch (props.verificationType) {
    case 'in_person':
      text = (
        <>
          {props.voucheeUsername} told me their username <Kb.Text type="BodyBold">in person</Kb.Text>
        </>
      )
      color = Styles.globalColors.greenDark
      break
    case 'video':
      text = `${props.voucheeUsername} told me their username over video`
      color = '#56fff5'
      break
    case 'audio':
      text = `${props.voucheeUsername} told me their username over audio`
      color = Styles.globalColors.blueLight
      break
    case 'proofs':
      text = `I know one of ${props.voucheeUsername}'s proofs`
      color = Styles.globalColors.blueLight
      break
    case 'other_chat':
      text = `${props.voucheeUsername} texted me their username`
      color = Styles.globalColors.yellow
      break
    case 'familiar':
      text = 'We are longtime Keybase friends'
      color = Styles.globalColors.yellow
      break
    case 'other':
      text = 'Other'
      color = Styles.globalColors.yellowDark
      break
  }
  return (
    <Kb.Box2 direction="horizontal" alignSelf="stretch" alignItems="center">
      <Kb.Box2
        direction="vertical"
        alignSelf="stretch"
        style={{backgroundColor: color, flexShrink: 0, width: 6}}
      />
      <Kb.RadioButton
        label={
          <Kb.Text type="Body" style={Styles.globalStyles.flexOne}>
            {text}
          </Kb.Text>
        }
        selected={props.selected}
        onSelect={props.onSelect}
        style={styles.choiceRadio}
      />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      approveNote: {paddingTop: Styles.globalMargins.tiny},
      buttonBar: {minHeight: undefined},
      choiceRadio: {
        flex: 1,
        paddingBottom: Styles.globalMargins.tiny,
        paddingLeft: Styles.globalMargins.small,
        paddingTop: Styles.globalMargins.tiny,
      },
      id: {paddingBottom: Styles.globalMargins.tiny, paddingTop: Styles.globalMargins.tiny},
      idInner: {
        flex: 1,
        paddingLeft: Styles.globalMargins.tiny,
      },
      outside: {paddingTop: Styles.globalMargins.tiny},
      outsideBox: {paddingBottom: Styles.globalMargins.small},
      sidePadding: {paddingLeft: Styles.globalMargins.small, paddingRight: Styles.globalMargins.small},
    } as const)
)
