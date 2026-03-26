import * as Kb from '@/common-adapters'
import Menubar from './index.desktop'
import loadRemoteComponent from '../desktop/remote/component-loader.desktop'
import {RemoteDarkModeSync} from '../desktop/remote/remote-component.desktop'
import type {Props} from './index.desktop'

const RemoteMenubar = (p: Props) => (
  <RemoteDarkModeSync darkMode={p.darkMode}>
    <Menubar {...p} />
  </RemoteDarkModeSync>
)

// This is to keep that arrow and gap on top w/ transparency
const style = {
  ...Kb.Styles.globalStyles.flexBoxColumn,
  borderTopLeftRadius: 4,
  borderTopRightRadius: 4,
  flex: 1,
  marginTop: 0,
  position: 'relative',
} as const

loadRemoteComponent<Props>({
  Component: RemoteMenubar,
  component: 'menubar',
  showOnProps: false,
  style,
})
