// KB_E2E_THEME=dark runs the iOS flows with the simulator in dark appearance. Its results are their
// own project, so the report shows them as "dark" cards beside the light ones instead of replacing them.
const theme = () => {
  const t = process.env['KB_E2E_THEME'] || 'light'
  if (t !== 'light' && t !== 'dark') throw new Error(`KB_E2E_THEME must be light or dark, not ${t}`)
  return t
}

export const iosDark = () => theme() === 'dark'
export const iosFlowProject = () => (iosDark() ? 'ios-flows-dark' : 'ios-flows')
export const iosVariantOf = (projectName: string) => (projectName.endsWith('-dark') ? 'dark' : undefined)
