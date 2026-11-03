type TrustedTypes = {
  createPolicy: (name: string, rules: {createScriptURL: (url: string) => string}) => {
    createScriptURL: (url: string) => object
  }
}
declare const trustedTypes: TrustedTypes

// Must match the trusted-types allow-list in vite.config.mts
export const pdfPreviewPolicyName = 'kb-pdf-preview'

// PDF previews come only from the service's local http servers: chat attachments at /at and
// KBFS files under /files/. Mirrors isSubframeURLAllowed in desktop/app/bridge-rules.desktop.tsx.
export const isPdfPreviewURL = (url: string) => {
  if (!URL.canParse(url)) return false
  const u = new URL(url)
  return (
    u.protocol === 'http:' &&
    u.hostname === '127.0.0.1' &&
    (u.pathname === '/at' || u.pathname.startsWith('/files/'))
  )
}

let policy: ReturnType<TrustedTypes['createPolicy']> | undefined
const trustedPdfURL = (url: string) => {
  if (!isPdfPreviewURL(url)) return undefined
  policy ??= trustedTypes.createPolicy(pdfPreviewPolicyName, {
    createScriptURL: (u: string) => {
      if (!isPdfPreviewURL(u)) throw new Error('Not a PDF preview URL')
      return u
    },
  })
  return policy.createScriptURL(url)
}

type Props = {url?: string}

// The renderer's CSP requires Trusted Types for script sinks, and <embed src> is one, so a plain
// string src is blocked. React hands a non-string src to setAttribute untouched.
export const PdfEmbed = ({url}: Props) => {
  const src = url ? trustedPdfURL(url) : undefined
  return <embed src={src as string | undefined} width="100%" height="100%" />
}
