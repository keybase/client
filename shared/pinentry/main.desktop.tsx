// Entry point for the pinentry render window
import '../desktop/renderer/globals.desktop'
import {waitOnKB2Loaded} from '@/util/electron'
waitOnKB2Loaded(() => require('./main2.desktop') as () => void)
