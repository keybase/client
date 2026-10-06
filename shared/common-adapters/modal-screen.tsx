import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'
import ScrollView from './scroll-view'
import ModalFooter from './modal-footer'
import {useModalBox} from './modal-box'

export type ModalScreenProps = {
  children: React.ReactNode
  // above the body, full width (errors, notices)
  banner?: React.ReactNode
  // laid out in the shared ModalFooter
  footer?: React.ReactNode
  // false: the body is a flex-1 box and the screen's own list scrolls. Needs a medium or large box:
  // a small box sizes to its content, so a list or BoxGrow body collapses to nothing.
  scroll?: boolean
  padding?: 'standard' | 'none'
  centered?: boolean
  testID?: string
}

// The body of a modal route: banner, body, footer, filling the modal box (desktop) or the sheet (phone).
const ModalScreen = (props: ModalScreenProps) => {
  const {children, banner, footer, scroll = true, padding = 'standard', centered, testID} = props
  const styles = useStyles()
  const box = useModalBox()
  const boxSize = box?.size

  React.useEffect(() => {
    if (__DEV__ && !scroll && boxSize === 'small') {
      console.warn(
        'ModalScreen: scroll={false} in a small modal. A small box sizes to its content, so a list or BoxGrow body collapses; use modalSize medium or large.'
      )
    }
  }, [scroll, boxSize])

  const bodyStyle = Styles.collapseStyles([
    padding === 'standard' && styles.padding,
    centered && styles.centered,
  ])

  return (
    <Box2 direction="vertical" fullWidth={true} style={styles.screen} testID={testID}>
      {banner}
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={Styles.collapseStyles([styles.scrollContent, bodyStyle])}
          alwaysBounceVertical={false}
        >
          {children}
        </ScrollView>
      ) : (
        <Box2 direction="vertical" fullWidth={true} flex={1} style={Styles.collapseStyles([styles.fill, bodyStyle])}>
          {children}
        </Box2>
      )}
      {footer ? <ModalFooter>{footer}</ModalFooter> : null}
    </Box2>
  )
}

const useStyles = Styles.createStyleHook(() => ({
  centered: Styles.platformStyles({
    common: {alignItems: 'center', justifyContent: 'center'},
    // fill a fixed-height box so the content centers vertically too
    isElectron: {boxSizing: 'border-box', minHeight: '100%'},
  }),
  fill: {minHeight: 0},
  padding: {padding: Styles.globalMargins.small},
  screen: {flexGrow: 1, flexShrink: 1, minHeight: 0},
  scroll: {flexGrow: 1, flexShrink: 1, minHeight: 0},
  scrollContent: Styles.platformStyles({
    isElectron: {display: 'flex', flexDirection: 'column'},
    isMobile: {flexGrow: 1},
  }),
}))

export default ModalScreen
