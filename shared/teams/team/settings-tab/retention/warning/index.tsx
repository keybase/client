import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {RetentionEntityType} from '..'

type Props = {
  enabled: boolean
  entityType: RetentionEntityType
  exploding: boolean
  setEnabled: (enabled: boolean) => undefined
  timePeriod: string
  onConfirm: () => void
  onBack: () => void
}

const iconType = Styles.isMobile ? 'icon-message-retention-64' : 'icon-message-retention-48'
const explodeIconType = 'icon-illustration-exploding-messages-240'

const Wrapper = ({children, onBack}: {children: React.ReactNode; onBack: () => void}) =>
  Styles.isMobile ? (
    <Kb.ScrollView
      style={{...Styles.globalStyles.fillAbsolute, ...Styles.globalStyles.flexBoxColumn}}
      children={children}
    />
  ) : (
    <Kb.PopupDialog onClose={onBack} children={children} />
  )

const RetentionWarning = (props: Props) => {
  let showChannelWarnings = false
  if (props.entityType === 'big team') {
    showChannelWarnings = true
  }
  let convType: string = getConvType(props.entityType)
  return (
    <Wrapper onBack={props.onBack}>
      <Kb.Box style={styles.container}>
        <Kb.Icon type={props.exploding ? explodeIconType : iconType} style={styles.iconStyle} />
        <Kb.Text center={true} type="Header" style={styles.headerStyle}>
          {props.exploding ? 'Explode' : 'Destroy'} chat messages after {props.timePeriod}?
        </Kb.Text>
        <Kb.Text center={true} type="Body" style={styles.bodyStyle}>
          You are about to set the messages in this {convType} to{' '}
          {props.exploding ? 'explode after ' : 'be deleted after '}
          <Kb.Text type="BodySemibold">{props.timePeriod}.</Kb.Text>{' '}
          {showChannelWarnings &&
            "This will affect all the team's channels, except the ones you've set manually."}
        </Kb.Text>
        <Kb.Checkbox
          checked={props.enabled}
          onCheck={props.setEnabled}
          style={styles.checkboxStyle}
          label=""
          labelComponent={
            <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.flexOne}>
              <Kb.Text type="Body">
                I understand that messages older than {props.timePeriod} will be deleted for everyone.
              </Kb.Text>
              {showChannelWarnings && (
                <Kb.Text type="BodySmall">Channels you've set manually will not be affected.</Kb.Text>
              )}
            </Kb.Box2>
          }
        />
        <Kb.ButtonBar>
          <Kb.Button type="Dim" onClick={props.onBack} label="Cancel" />
          <Kb.Button
            type="Danger"
            onClick={props.onConfirm}
            label={Styles.isMobile ? 'Confirm' : `Yes, set to ${props.timePeriod}`}
            disabled={!props.enabled}
          />
        </Kb.ButtonBar>
      </Kb.Box>
    </Wrapper>
  )
}

const getConvType = (entityType: RetentionEntityType) => {
  let convType = ''
  switch (entityType) {
    case 'small team':
      convType = "team's chat"
      break
    case 'big team':
      convType = "team's chat"
      break
    case 'channel':
      convType = 'channel'
      break
    case 'adhoc':
      convType = 'conversation'
      break
  }
  if (convType === '') {
    throw new Error(`RetentionWarning: impossible entityType encountered: ${entityType}`)
  }
  return convType
}

const styles = Styles.styleSheetCreate({
  bodyStyle: {marginBottom: Styles.globalMargins.small},
  checkboxStyle: Styles.platformStyles({
    isElectron: {
      marginBottom: Styles.globalMargins.xlarge,
    },
    isMobile: {
      marginBottom: Styles.globalMargins.small,
      width: '100%',
    },
  }),
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      maxWidth: 560,
      paddingBottom: Styles.globalMargins.large,
    },
    isElectron: {
      paddingLeft: Styles.globalMargins.xlarge,
      paddingRight: Styles.globalMargins.xlarge,
      paddingTop: Styles.globalMargins.xlarge,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.small,
    },
  }),
  flexOne: {flex: 1},
  headerStyle: {marginBottom: Styles.globalMargins.small},
  iconStyle: {marginBottom: 20},
})

export default Kb.HeaderOnMobile(RetentionWarning)
