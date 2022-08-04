// @ts-ignore
import type {TurboModule} from 'react-native/Libraries/TurboModule/RCTExport'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
  getConstants: () => {}

  //
  // Regular JSI
  //
  getGreeting(name: string): string

  //
  // C++ shared code
  //
  turboMultiply(num1: number, num2: number): number
}

export default TurboModuleRegistry.getEnforcing<Spec>('GoJSIBridge')
