import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {PathItemAction, PathItemInfo, PathItemIcon} from '../common'
import {fileUIName, isMobile, isIOS} from '../../constants/platform'
import {hasShare} from '../common/path-item-action/layout'

type DefaultViewProps = {
  download: () => void
  sfmiEnabled: boolean
  path: Types.Path
  pathItem: Types.PathItem
  showInSystemFileManager: () => void
}

const DefaultView = (props: DefaultViewProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      centerChildren={true}
      style={styles.innerContainer}
    >
      <PathItemIcon path={props.path} size={96} />
      <Kb.Text type="BodyBig" style={styles.filename}>
        {props.pathItem.name}
      </Kb.Text>
      <Kb.Text type="BodySmall">{Constants.humanReadableFileSize(props.pathItem.size)}</Kb.Text>
      {isMobile && <PathItemInfo path={props.path} mode="default" />}
      {props.pathItem.type === Types.PathType.Symlink && (
        <Kb.Text type="BodySmall" style={stylesSymlink}>
          {'This is a symlink' + (props.pathItem.linkTarget ? ` to: ${props.pathItem.linkTarget}.` : '.')}
        </Kb.Text>
      )}
      {isMobile && (
        <Kb.Text center={true} type="BodySmall" style={stylesNoOpenMobile}>
          This document can not be opened on mobile. You can still interact with it using the ••• menu.
        </Kb.Text>
      )}
      {// Enable this button for desktop when we have in-app sharing.
      hasShare('screen', props.path, props.pathItem) && (
        <>
          <Kb.Box2 direction="vertical" gap="medium" gapStart={true} />
          <PathItemAction
            clickable={{
              component: ({onClick, setRef}) => (
                <Kb.Button key="share" label="Share" onClick={onClick} ref={setRef} />
              ),
              type: 'component',
            }}
            path={props.path}
            initView={Types.PathItemActionMenuView.Share}
            mode="screen"
          />
        </>
      )}
      {!isIOS &&
        (props.sfmiEnabled ? (
          <Kb.Button
            key="open"
            type="Dim"
            label={'Show in ' + fileUIName}
            style={{marginTop: Styles.globalMargins.small}}
            onClick={props.showInSystemFileManager}
          />
        ) : (
          <Kb.Button
            key="download"
            mode="Secondary"
            label="Download"
            style={{marginTop: Styles.globalMargins.small}}
            onClick={props.download}
          />
        ))}
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      padding: Styles.globalMargins.medium,
    },
    isMobile: {
      paddingTop: Styles.globalMargins.mediumLarge,
    },
  }),
  filename: {
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.small,
  },
  innerContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      ...Styles.globalStyles.flexGrow,
      alignItems: 'center',
      backgroundColor: Styles.globalColors.white,
      flex: 1,
      justifyContent: 'center',
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.large,
      paddingRight: Styles.globalMargins.large,
    },
  }),
})

const stylesSymlink = {marginTop: Styles.globalMargins.medium}

const stylesNoOpenMobile = {marginTop: Styles.globalMargins.medium}

export default DefaultView
