// Entry point for the tracker render window
import '../desktop/renderer/globals.desktop'
import {waitOnKB2Loaded} from '@/util/electron'
waitOnKB2Loaded(() => {
  import('./main2.desktop').then(() => {}).catch(() => {})
})
