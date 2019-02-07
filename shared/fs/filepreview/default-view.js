// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import * as Kb from '../../common-adapters'
import {PathItemAction, PathItemInfo, PathItemIcon} from '../common'
import {memoize} from 'lodash-es'
import {fileUIName, isMobile, isIOS} from '../../constants/platform'
import {hasShare} from '../common/path-item-action/layout'

type DefaultViewProps = {
  download: () => void,
  fileUIEnabled: boolean,
  path: Types.Path,
  pathItem: Types.PathItem,
  routePath: I.List<string>,
  showInSystemFileManager: () => void,
}

const DefaultView = (props: DefaultViewProps) => (
  <Kb.Box style={stylesContainer}>
    <PathItemIcon path={props.path} size={32} />
    <Kb.Text type="BodyBig" style={stylesFilename(Constants.getPathTextColor(props.path))}>
      {props.pathItem.name}
    </Kb.Text>
    <Kb.Text type="BodySmall">{Constants.humanReadableFileSize(props.pathItem.size)}</Kb.Text>
    {isMobile && <PathItemInfo path={props.path} mode="default" />}
    {props.pathItem.type === 'symlink' && (
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
    hasShare(props.path, props.pathItem) && (
      <>
        <Kb.Box2 direction="vertical" gap="medium" gapStart={true} />
        <PathItemAction
          clickable={{
            component: ({onClick, setRef}) => (
              <Kb.Button key="share" type="Primary" label="Share" onClick={onClick} ref={setRef} />
            ),
            type: 'component',
          }}
          path={props.path}
          routePath={props.routePath}
          initView="share"
        />
      </>
    )}
    {!isIOS &&
      (props.fileUIEnabled ? (
        <Kb.Button
          key="open"
          type="Secondary"
          label={'Show in ' + fileUIName}
          style={{marginTop: globalMargins.small}}
          onClick={props.showInSystemFileManager}
        />
      ) : (
        <Kb.Button
          key="download"
          type="Secondary"
          label="Download a copy"
          style={{marginTop: globalMargins.small}}
          onClick={props.download}
        />
      ))}
  </Kb.Box>
)

const stylesContainer = platformStyles({
  common: {
    ...globalStyles.flexBoxColumn,
    ...globalStyles.flexGrow,
    alignItems: 'center',
    backgroundColor: globalColors.white,
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  isElectron: {
    marginBottom: globalMargins.medium,
    marginTop: globalMargins.medium,
  },
  isMobile: {
    marginTop: 32,
    paddingLeft: 40,
    paddingRight: 40,
  },
})

const stylesFilename = memoize(color => ({
  color: color,
  marginBottom: globalMargins.tiny,
  marginTop: globalMargins.small,
}))

const stylesSymlink = {marginTop: globalMargins.medium}

const stylesNoOpenMobile = {marginTop: globalMargins.medium}

export default DefaultView
