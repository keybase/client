// The screen as a base64 PNG, as browser.takeScreenshot gives it. A Duo run (KB_IOS_SCREEN, set in
// wdio.gate.conf.ts) captures the lit screen through simctl: Appium's screenshot is always the outer one.
import {parseScreenTarget, simctlScreenshot} from '../helpers/form-factor.mts'

export const screenPng = async (): Promise<string> => {
  const target = parseScreenTarget(process.env['KB_IOS_SCREEN'])
  if (!target) return browser.takeScreenshot()
  return (await simctlScreenshot(target.udid, target.displayId)).toString('base64')
}
