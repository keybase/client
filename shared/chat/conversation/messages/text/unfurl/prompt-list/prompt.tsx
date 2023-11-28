import * as React from 'react'
import * as Kb from '@/common-adapters/index'

export type Props = {
  domain: string
  onAlways: () => void
  onAccept: () => void
  onOnetime: () => void
  onNotnow: () => void
  onNever: () => void
}

const promptIcon = Kb.Styles.isMobile
  ? 'icon-fancy-unfurl-preview-mobile-128-128'
  : 'icon-fancy-unfurl-preview-desktop-96-96'

const UnfurlPrompt = (p: Props) => {
  const {onAlways, onAccept, onOnetime, domain, onNotnow, onNever} = p
  return (
    <Kb.Box2 direction="horizontal" style={styles.container} fullWidth={true}>
      {!Kb.Styles.isMobile && <Kb.Icon type={promptIcon} style={styles.icon} />}
      <Kb.Box2 direction="vertical" style={styles.choiceContainer} gap="xtiny">
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text type="BodySemibold">Would you like to post a preview?</Kb.Text>
          <Kb.Text type="Body">Your Keybase app will visit the link and post a preview of it.</Kb.Text>
        </Kb.Box2>
        <Kb.Text onClick={onAlways} type="BodyPrimaryLink">
          Always, for any site
        </Kb.Text>
        <Kb.Text onClick={onAccept} type="BodyPrimaryLink">
          Always, for {domain}
        </Kb.Text>
        <Kb.Text onClick={onOnetime} type="BodyPrimaryLink">
          Yes, but ask me again for {domain}
        </Kb.Text>
        <Kb.Text onClick={onNotnow} type="BodyPrimaryLink">
          Not now
        </Kb.Text>
        <Kb.Text onClick={onNever} type="BodyPrimaryLink">
          Never, for any site
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" style={styles.closeContainer}>
        <Kb.Icon type="iconfont-close" onClick={onNotnow} fontSize={16} padding="xtiny" />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      choiceContainer: Kb.Styles.platformStyles({
        isElectron: {width: 370},
      }),
      closeContainer: Kb.Styles.platformStyles({
        common: {alignSelf: 'flex-start'},
        isElectron: {
          marginLeft: 'auto',
          width: 30,
        },
      }),
      container: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxRow,
          alignSelf: 'flex-start',
          backgroundColor: Kb.Styles.globalColors.blueLighter3,
          borderRadius: Kb.Styles.borderRadius,
          paddingBottom: Kb.Styles.globalMargins.tiny,
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {maxWidth: 600},
      }),
      icon: Kb.Styles.platformStyles({
        isElectron: {
          alignSelf: 'center',
          marginLeft: Kb.Styles.globalMargins.small,
          marginRight: Kb.Styles.globalMargins.small,
        },
      }),
    }) as const
)

export default UnfurlPrompt
