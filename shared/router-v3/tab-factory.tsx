import * as Container from '../util/container'
import TabDesktop from './tab-factory-desktop'
import TabMobile from './tab-factory-mobile'

export const Tab = Container.isMobile ? TabMobile() : TabDesktop()

