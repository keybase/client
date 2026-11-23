// KB_E2E_THEME=dark runs the iOS flows with the simulator in dark appearance. Its results are their
// own project, so the report shows them as "dark" cards beside the light ones instead of replacing them.
import {formFactorLabel, type FormFactor} from './helpers/form-factor.mts'

export type IosTheme = 'light' | 'dark'

export const iosTheme = (): IosTheme => {
  const t = process.env['KB_E2E_THEME'] || 'light'
  if (t !== 'light' && t !== 'dark') throw new Error(`KB_E2E_THEME must be light or dark, not ${t}`)
  return t
}

// The wdio project a run's results go under: ios-flows, then the form factor unless iPhone, then
// -dark. The report keys and labels its cards by the suffix (the variant) and filters them by device.
const PROJECT = 'ios-flows'
export const iosFlowProject = (formFactor: FormFactor = 'iphone', theme: IosTheme = iosTheme()) =>
  [PROJECT, ...(formFactor === 'iphone' ? [] : [formFactor]), ...(theme === 'dark' ? ['dark'] : [])].join('-')

export const iosVariantOf = (projectName: string) =>
  projectName.startsWith(`${PROJECT}-`) ? projectName.slice(PROJECT.length + 1) : undefined

// the device a card's variant (iosVariantOf) ran on
export const iosDeviceOf = (variant: string | undefined) => formFactorLabel(variant?.replace(/-?dark$/, '') || 'iphone')
