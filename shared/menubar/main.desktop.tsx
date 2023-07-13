// Entry point for the menubar render window
import '../desktop/renderer/globals.desktop'
import {waitOnKB2Loaded} from '../util/electron.desktop'
waitOnKB2Loaded(() => {
  import('./main2.desktop').then(() => {}).catch(() => {})
})
