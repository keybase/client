import logger from '@/logger'
import {isPreviewURL} from '@/util/local-server-url'

type TrustedTypes = {
  createPolicy: (name: string, rules: {createScriptURL: (url: string) => string}) => {
    createScriptURL: (url: string) => object
  }
}
declare const trustedTypes: TrustedTypes

let policy: ReturnType<TrustedTypes['createPolicy']> | undefined
const trustedPdfURL = (url: string) => {
  if (!isPreviewURL(url)) {
    logger.warn('PdfEmbed: not a local preview URL, not loading it')
    return undefined
  }
  // The name must be in the trusted-types allow-list in vite.config.mts. The policy itself rejects
  // anything but a local preview URL so it stays safe whoever calls it.
  policy ??= trustedTypes.createPolicy('kb-pdf-preview', {
    createScriptURL: (u: string) => {
      if (!isPreviewURL(u)) throw new Error('Not a PDF preview URL')
      return u
    },
  })
  return policy.createScriptURL(url)
}

type Props = {url?: string; testID?: string}

// The renderer's CSP requires Trusted Types for script sinks, and <embed src> is one, so a plain
// string src is blocked. React hands a non-string src to setAttribute untouched.
export const PdfEmbed = ({url, testID}: Props) => {
  const src = url ? trustedPdfURL(url) : undefined
  // the testID only once there is a file to show
  return <embed src={src as string | undefined} width="100%" height="100%" data-testid={src ? testID : undefined} />
}
