import type * as React from 'react'
import {Box2} from './box'
import Text from './text'

const Kb = {
  Box2,
  Text,
}

const allowedHosts = new Set(['127.0.0.1', 'localhost'])
const hasAllowedChars = (url: string) => /^[a-zA-Z0-9=.%:?/&-_]*$/.test(url)
const hasScheme = (url: string) => /^[a-z][a-z\d+.-]*:/i.test(url)

const isAllowedHostURL = (url: string) => {
  try {
    const parsed = new URL(url.startsWith('//') ? `http:${url}` : url)
    if (allowedHosts.has(parsed.hostname.toLowerCase())) {
      return true
    }
  } catch {}
  return false
}

const isAllowedFilePath = (url: string, allowFile?: boolean) => {
  if (!allowFile || url.startsWith('//')) {
    return false
  }

  if (/^[a-z]:\//i.test(url)) {
    return true
  }

  if (!hasScheme(url)) {
    return true
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'file:' && parsed.hostname === '') {
      return true
    }
  } catch {}

  return false
}

const urlIsOK = (url: string, allowFile?: boolean) =>
  hasAllowedChars(url) && (isAllowedHostURL(url) || isAllowedFilePath(url, allowFile))

export const useCheckURL = (children: React.ReactElement, url: string, allowFile?: boolean) => {
  const ok = urlIsOK(url, allowFile)
  return ok ? (
    children
  ) : (
    <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true} centerChildren={true}>
      <Kb.Text type="BodySmall">Invalid URL: {url}</Kb.Text>
    </Kb.Box2>
  )
}
