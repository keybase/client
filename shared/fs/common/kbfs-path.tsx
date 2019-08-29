import * as React from 'react'
import * as FsTypes from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import PathInfo from './path-info'
import PathItemInfo from './path-item-info'

type Props = {
  deeplinkPath: string
  platformAfterMountPath: string
  rawPath: string
  standardPath: FsTypes.Path
}

type PopupProps = Props & {
  attachRef: React.RefObject<Kb.Text>
  onHidden: () => void
  visible: boolean
}

const KbfsPathPopup = (props: PopupProps) => {
  const {deeplinkPath, platformAfterMountPath, standardPath} = props
  const header = {
    title: 'header',
    view: (
      <Kb.Box2 direction="vertical" style={styles.headerContainer}>
        <PathItemInfo
          path={standardPath}
          showTooltipOnName={false}
          containerStyle={styles.sectionContainer}
        />
        <Kb.Divider style={styles.headerDivider} />
        <PathInfo
          deeplinkPath={deeplinkPath}
          platformAfterMountPath={platformAfterMountPath}
          containerStyle={styles.sectionContainer}
        />
      </Kb.Box2>
    ),
  }
  return (
    <Kb.FloatingMenu
      closeOnSelect={true}
      containerStyle={undefined}
      attachTo={() => props.attachRef.current}
      onHidden={props.onHidden}
      position="top center"
      positionFallbacks={[]}
      header={header}
      items={[]}
      visible={props.visible}
    />
  )
}

const KbfsPath = (props: Props) => {
  const [showing, setShowing] = React.useState(false)
  const textRef = React.useRef<Kb.Text>(null)
  const text = (
    <Kb.Text type="BodyPrimaryLink" onClick={() => setShowing(true)} allowFontScaling={true} ref={textRef}>
      {props.rawPath}
    </Kb.Text>
  )
  const popup = showing ? (
    <KbfsPathPopup attachRef={textRef} visible={showing} onHidden={() => setShowing(false)} {...props} />
  ) : null
  return Styles.isMobile ? (
    <>
      {text}
      {popup}
    </>
  ) : (
    <Kb.Box
      style={styles.textContainer}
      onMouseOver={() => setShowing(true)}
      onMouseLeave={() => setShowing(false)}
    >
      {text}
      {popup}
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate({
  headerContainer: Styles.platformStyles({
    common: {},
    isElectron: {
      maxWidth: 280,
    },
  }),
  headerDivider: {
    marginTop: Styles.globalMargins.small,
  },
  sectionContainer: {
    padding: Styles.globalMargins.small,
  },
  textContainer: Styles.platformStyles({
    isElectron: {
      display: 'inline-block',
    },
  }),
})

export default KbfsPath
