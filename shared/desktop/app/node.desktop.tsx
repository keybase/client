// Entry point for the node part of the electron app
// order of modules is important here
import '../renderer/preload.desktop'
import KB2 from '../../util/electron.desktop'
import {configOverload} from './dynamic-config'

// This isn't ideal. In order to load the config overload from the disk we need paths
// which are loaded from the KB2. Maybe we split this up later but for now we just inject it
// back inside before we load the rest of the app
KB2.constants.configOverload = configOverload
require('./node2.desktop')
