import type * as React from 'react'
import {Box2} from './box'
import {Text3} from './text3'
import URL from 'url-parse'

const Kb = {
  Box2,
  Text3,
}

const urlIsOK = (url: string, allowFile?: boolean) => {
  const allowedHosts = ['127.0.0.1', 'localhost']

  // This should be as limited as possible, to avoid injections.
  if (/^[a-zA-Z0-9=.%:?/&-_]*$/.test(url)) {
    const u = new URL(url)
    if (allowedHosts.includes(u.hostname)) {
      return true
    }

    if (allowFile && u.hostname === '') {
      return true
    }
  }
  return false
}

export const useCheckURL = (children: React.ReactElement, url: string, allowFile?: boolean) => {
  const ok = urlIsOK(url, allowFile)
  return ok ? (
    children
  ) : (
    <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true} centerChildren={true}>
      <Kb.Text3 type="BodySmall">Invalid URL: {url}</Kb.Text3>
    </Kb.Box2>
  )
}
