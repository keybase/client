import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {RetentionEntityType} from '..'

type Props = {
  entityType: RetentionEntityType
  exploding: boolean
  timePeriod: string
  onConfirm: () => void
  onBack: () => void
}

const Wrapper = ({children}: {children: React.ReactNode}) =>
  Kb.Styles.isMobile ? (
    <Kb.ScrollView
      style={{...Kb.Styles.globalStyles.fillAbsolute, ...Kb.Styles.globalStyles.flexBoxColumn}}
      contentContainerStyle={styles.scrollContainer}
      children={children}
    />
  ) : (
    <Kb.PopupDialog children={children} />
  )

const RetentionWarning = (props: Props) => {
  const [enabled, setEnabled] = React.useState(false)

  let showChannelWarnings = false
  if (props.entityType === 'big team') {
    showChannelWarnings = true
  }
  const convType: string = getConvType(props.entityType)
  return (
    <Wrapper>
      <Kb.Box style={styles.container}>
        <Kb.Box style={styles.iconBoxStyle}>
          <Kb.Icon
            color={props.exploding ? Kb.Styles.globalColors.black : Kb.Styles.globalColors.black_20}
            fontSize={48}
            type={props.exploding ? 'iconfont-bomb-solid' : 'iconfont-timer-solid'}
          />
        </Kb.Box>
        <Kb.Text center={true} type="Header" style={styles.headerStyle}>
          {props.exploding ? 'Explode' : 'Auto-delete'} chat messages after {props.timePeriod}?
        </Kb.Text>
        <Kb.Text center={true} type="Body" style={styles.bodyStyle}>
          You are about to set the messages in this {convType} to{' '}
          {props.exploding ? 'explode after ' : 'be automatically deleted after '}
          <Kb.Text type="BodyBold">{props.timePeriod}.</Kb.Text>{' '}
          {showChannelWarnings &&
            "This will affect all the team's channels, except the ones you've set manually."}
        </Kb.Text>
        <Kb.Checkbox
          checked={enabled}
          onCheck={setEnabled}
          style={styles.checkboxStyle}
          label=""
          labelComponent={
            <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.label}>
              <Kb.Text type="Body">
                I understand that existing messages older than {props.timePeriod} will be deleted now, for
                everyone.
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
            label={Kb.Styles.isMobile ? 'Confirm' : `Yes, set to ${props.timePeriod}`}
            disabled={!enabled}
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  bodyStyle: {marginBottom: Kb.Styles.globalMargins.small},
  checkboxStyle: Kb.Styles.platformStyles({
    isElectron: {
      marginBottom: Kb.Styles.globalMargins.xlarge,
    },
    isMobile: {
      marginBottom: Kb.Styles.globalMargins.small,
    },
  }),
  container: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      paddingBottom: Kb.Styles.globalMargins.large,
    },
    isElectron: {
      paddingLeft: Kb.Styles.globalMargins.xlarge,
      paddingRight: Kb.Styles.globalMargins.xlarge,
      paddingTop: Kb.Styles.globalMargins.xlarge,
    },
    isMobile: {
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
      paddingTop: Kb.Styles.globalMargins.small,
    },
  }),
  headerStyle: {marginBottom: Kb.Styles.globalMargins.small},
  iconBoxStyle: {marginBottom: 20},
  label: {flexShrink: 1},
  scrollContainer: {
    ...Kb.Styles.globalStyles.flexBoxCenter,
    flex: 1,
  },
}))

export default RetentionWarning
