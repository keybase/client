import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import PathInfo from './path-info'
import PathItemInfo from './path-item-info'

type Props = {
  knownPathInfo?: Types.PathInfo
  rawPath: string
  standardPath: Types.Path
}

type PopupProps = Props & {
  attachRef: React.RefObject<Kb.Text>
  onHidden: () => void
  visible: boolean
}

const useOpenInFilesTab = (path: Types.Path) => {
  const dispatch = Container.useDispatch()
  return React.useCallback(() => dispatch(Constants.makeActionForOpenPathInFilesTab(path)), [path, dispatch])
}

const KbfsPathPopup = (props: PopupProps) => {
  const openInFilesTab = useOpenInFilesTab(props.standardPath)
  const header = {
    title: 'header',
    view: (
      <Kb.Box2 direction="vertical" style={styles.headerContainer}>
        <PathItemInfo
          path={props.standardPath}
          showTooltipOnName={false}
          containerStyle={styles.sectionContainer}
        />
        <Kb.Divider />
        <PathInfo
          path={props.standardPath}
          knownPathInfo={props.knownPathInfo}
          containerStyle={styles.sectionContainer}
        />
      </Kb.Box2>
    ),
  }
  return (
    <Kb.FloatingMenu
      closeOnSelect={true}
      attachTo={() => props.attachRef.current}
      onHidden={props.onHidden}
      position="top center"
      propagateOutsideClicks={!Styles.isMobile}
      header={header}
      items={
        Styles.isMobile
          ? [
              {
                onClick: openInFilesTab,
                title: 'Open',
              },
            ]
          : []
      }
      visible={props.visible}
    />
  )
}

const KbfsPath = (props: Props) => {
  const [showing, setShowing] = React.useState(false)
  const textRef = React.useRef<Kb.Text>(null)
  const openInFilesTab = useOpenInFilesTab(props.standardPath)
  const text = (
    <Kb.Text
      type="BodyPrimaryLink"
      onClick={Styles.isMobile ? () => setShowing(true) : openInFilesTab}
      allowFontScaling={true}
      ref={textRef}
    >
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

const styles = Styles.styleSheetCreate(() => ({
  headerContainer: Styles.platformStyles({
    common: {},
    isElectron: {
      maxWidth: 280,
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.medium,
    },
  }),
  sectionContainer: {
    padding: Styles.globalMargins.small,
  },
  textContainer: Styles.platformStyles({
    isElectron: {
      display: 'inline-block',
    },
  }),
}))

export default KbfsPath
