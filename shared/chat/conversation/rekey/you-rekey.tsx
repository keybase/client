import * as Kb from '@/common-adapters'

type Props = {
  onEnterPaperkey: () => void
  onBack: () => void
  onRekey: () => void
}

const YouRekey = (p: Props) => {
  if (!isMobile) {
    return (
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        justifyContent="flex-start"
        flex={1}
        style={styles.container}
      >
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          justifyContent="center"
          style={{backgroundColor: Kb.Styles.globalColors.red}}
        >
          <Kb.Text
            negative={true}
            style={{...Kb.Styles.padding(8, 24)}}
            type="BodySemibold"
          >
            This conversation needs to be rekeyed.
          </Kb.Text>
        </Kb.Box2>
        <Kb.ButtonBar>
          <Kb.Button
            onClick={p.onRekey}
            label="Rekey"
            style={styles.primaryOnBlue}
            labelStyle={styles.primaryOnBlueLabel}
          />
        </Kb.ButtonBar>
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2 direction="vertical">
      <Kb.Banner color="red">
        <Kb.BannerParagraph bannerColor="red" content="This conversation needs to be rekeyed." />
      </Kb.Banner>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        justifyContent="flex-start"
        flex={1}
        style={styles.mobileContainer}
      >
        <Kb.Box2 direction="vertical" fullWidth={true} justifyContent="center" flex={1}>
          <Kb.Text center={true} type="BodySmall" style={styles.text} negative={true}>
            To unlock this conversation, open one of your other devices or enter a paperkey.
          </Kb.Text>
          <Kb.Button onClick={p.onEnterPaperkey} label="Enter a paper key" />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    backgroundColor: Kb.Styles.globalColors.blueDarker2,
  },
  mobileContainer: {
    padding: Kb.Styles.globalMargins.small,
  },
  primaryOnBlue: {backgroundColor: Kb.Styles.globalColors.white},
  primaryOnBlueLabel: {color: Kb.Styles.globalColors.blueDark},
  text: {
    marginBottom: Kb.Styles.globalMargins.large,
    marginTop: Kb.Styles.globalMargins.large,
  },
}))

export default YouRekey
