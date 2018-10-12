// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {compose, renameProp} from 'recompose'

type WalletModalProps = {|
  children: React.Node,
  onBack?: () => void,
  onClose: () => void,
  containerStyle?: Styles.StylesCrossPlatform,
  // Since the header is only displayed on mobile, its styles only apply to mobile.
  headerStyle?: Styles.StylesCrossPlatform,
  // Buttons to be placed in the bottom Button Bar.
  // If none are included, the bar is not rendered.
  bottomButtons?: Array<React.Node>,
|}

const WalletPopup = (props: WalletModalProps) => {
  const contentContainerStyle = Styles.collapseStyles([
    styles.container,
    props.onBack ? {paddingTop: Styles.globalMargins.small} : {},
    props.containerStyle,
  ])
  const ContentContainer = ({children}: {children: React.Node}) =>
    Styles.isMobile ? (
      <Kb.ScrollView contentContainerStyle={contentContainerStyle} children={children} />
    ) : (
      <Kb.Box2
        direction="vertical"
        centerChildren={true}
        fullWidth={true}
        fullHeight={true}
        style={contentContainerStyle}
        children={children}
      />
    )
  return (
    <Kb.Box2 direction="vertical" style={styles.outerContainer}>
      {props.onBack && <Kb.HeaderHocHeader onBack={props.onBack} headerStyle={styles.header} />}
      <ContentContainer>
        {props.children}
        {props.bottomButtons &&
          props.bottomButtons.length > 0 && (
            <Kb.Box2 direction="vertical" style={styles.buttonBarContainer} fullWidth={true}>
              <Kb.ButtonBar
                direction={Styles.isMobile ? 'column' : 'row'}
                fullWidth={Styles.isMobile}
                style={styles.buttonBar}
              >
                {props.bottomButtons}
              </Kb.ButtonBar>
            </Kb.Box2>
          )}
      </ContentContainer>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  outerContainer: Styles.platformStyles({
    isElectron: {
      height: 525,
      width: 360,
      borderRadius: 4,
    },
    isMobile: {
      width: '100%',
    },
  }),
  header: Styles.platformStyles({
    isElectron: {
      borderRadius: 4,
    },
  }),
  container: Styles.platformStyles({
    common: {
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
    },
    isElectron: {
      borderRadius: 'inherit',
      paddingBottom: Styles.globalMargins.xlarge,
      paddingTop: Styles.globalMargins.xlarge,
      textAlign: 'center',
    },
    isMobile: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      paddingBottom: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.xlarge,
      width: '100%',
    },
  }),
  buttonBarContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  buttonBar: Styles.platformStyles({
    isElectron: {
      minHeight: 0,
    },
  }),
})

export default compose(renameProp('onClose', 'onCancel'), Kb.HeaderOrPopup)(WalletPopup)
