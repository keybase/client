import * as React from 'react'
import * as Kb from '@/common-adapters/index'
import * as TestIDs from '@/tests/e2e/shared/test-ids'

export type Props = {
  domain: string
  onAnswer: (accept: boolean, remember: boolean) => void
  onDismiss: () => void
}

const promptIcon = isMobile
  ? 'icon-fancy-unfurl-preview-mobile-128-128'
  : 'icon-fancy-unfurl-preview-desktop-96-96'

const UnfurlPrompt = (p: Props) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const {domain, onAnswer, onDismiss} = p
  const [remember, setRemember] = React.useState(false)
  return (
    <Kb.Box2 direction="horizontal" alignSelf="flex-start" style={styles.container} fullWidth={true} testID={TestIDs.CHAT_UNFURL_PROMPT}>
      {!isMobile && <Kb.ImageIcon type={promptIcon} style={styles.icon} />}
      <Kb.Box2 direction="vertical" style={styles.choiceContainer} gap="xtiny">
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text type="BodySemibold">Would you like to post a preview?</Kb.Text>
          <Kb.Text type="Body">Your Keybase app will visit the link and post a preview of it.</Kb.Text>
        </Kb.Box2>
        <Kb.Checkbox checked={remember} onCheck={setRemember} label={`Remember for ${domain}`} />
        <Kb.Box2 direction="horizontal" gap="tiny" alignSelf="flex-start">
          <Kb.Button label="Yes" small={true} onClick={() => onAnswer(true, remember)} testID={TestIDs.CHAT_UNFURL_PROMPT_YES} />
          <Kb.Button
            label="No"
            mode="Secondary"
            small={true}
            onClick={() => onAnswer(false, remember)}
            testID={TestIDs.CHAT_UNFURL_PROMPT_NO}
          />
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" alignSelf="flex-start" style={styles.closeContainer}>
        <Kb.Icon type="iconfont-close" color={theme.black_20} onClick={onDismiss} fontSize={16} padding="xtiny" />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      choiceContainer: Kb.Styles.platformStyles({
        isElectron: {width: 370},
      }),
      closeContainer: Kb.Styles.platformStyles({
        isElectron: {
          marginLeft: 'auto',
          width: 30,
        },
      }),
      container: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxRow,
          backgroundColor: theme.blueLighter3,
          borderRadius: Kb.Styles.borderRadius,
          ...Kb.Styles.paddingV(Kb.Styles.globalMargins.tiny),
        },
        isElectron: {maxWidth: 600},
      }),
      icon: Kb.Styles.platformStyles({
        isElectron: {
          alignSelf: 'center',
          ...Kb.Styles.marginH(Kb.Styles.globalMargins.small),
        },
      }),
    }) as const
)

export default UnfurlPrompt
