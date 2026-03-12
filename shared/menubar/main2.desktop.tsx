import * as React from 'react'
import * as Kb from '@/common-adapters'
import Menubar from './index.desktop'
import load from '../desktop/remote/component-loader.desktop'
import {useDarkModeState} from '@/stores/darkmode'
import type {Props} from './index.desktop'

const DarkModeSync = ({darkMode, children}: {darkMode: boolean; children: React.ReactNode}) => {
  const setSystemDarkMode = useDarkModeState(s => s.dispatch.setSystemDarkMode)
  React.useEffect(() => {
    const id = setTimeout(() => setSystemDarkMode(darkMode), 1)
    return () => clearTimeout(id)
  }, [setSystemDarkMode, darkMode])
  return <>{children}</>
}

// This is to keep that arrow and gap on top w/ transparency
const style = {
  ...Kb.Styles.globalStyles.flexBoxColumn,
  borderTopLeftRadius: 4,
  borderTopRightRadius: 4,
  flex: 1,
  marginTop: 0,
  position: 'relative',
} as const

load<Props>({
  child: (p: Props) => (
    <DarkModeSync darkMode={p.darkMode}>
      <Menubar {...p} />
    </DarkModeSync>
  ),
  name: 'menubar',
  showOnProps: false,
  style,
})
