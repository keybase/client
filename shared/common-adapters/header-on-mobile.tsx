import * as React from 'react'
import {isMobile} from '../util/container'
import HeaderHoc from './header-hoc'

// HeaderOnMobile replaces our common pattern of `isMobile ? HeaderHoc(Foo) : Foo`
function HeaderOnMobile<P>(WrappedComponent: React.ComponentType<P>) {
  return isMobile ? HeaderHoc(WrappedComponent) : WrappedComponent
}

export default HeaderOnMobile
