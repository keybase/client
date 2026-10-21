import logger from '@/logger'

export const cspViolationPrefix = '[CSP violation]'

export type CspViolation = Pick<
  SecurityPolicyViolationEvent,
  'blockedURI' | 'effectiveDirective' | 'lineNumber' | 'sample' | 'sourceFile'
>

// URLs to the service's local http servers carry token= and key=, so a logged URL keeps only what
// comes before its query and hash
const maxURLLength = 200
export const stripURL = (url: string) => {
  const end = url.search(/[?#]/)
  return (end < 0 ? url : url.slice(0, end)).slice(0, maxURLLength)
}

// A Trusted Types sink violation's sample is "<sink>|<start of the value>"; only the sink is logged
export const describeCspViolation = (v: CspViolation) => {
  const blocked = stripURL(v.blockedURI) || '(none)'
  const sink = v.blockedURI === 'trusted-types-sink' ? ` ${v.sample.split('|')[0] ?? ''}` : ''
  const key = `${v.effectiveDirective} ${blocked}${sink}`
  const source = v.sourceFile ? `${stripURL(v.sourceFile)}:${v.lineNumber}` : '(no source)'
  return {key, message: `${cspViolationPrefix} ${key} at ${source}`}
}

// Logs each distinct directive + blocked URL once, and stops after maxDistinct of them, so a storm of
// violations (an image list, a render loop) stays a few lines
export const makeCspViolationLogger = (log: (message: string) => void, maxDistinct = 50) => {
  const seen = new Set<string>()
  let stopped = false
  return (v: CspViolation) => {
    if (stopped) return
    const {key, message} = describeCspViolation(v)
    if (seen.has(key)) return
    if (seen.size >= maxDistinct) {
      stopped = true
      log(`${cspViolationPrefix} more than ${maxDistinct} kinds, no longer logging`)
      return
    }
    seen.add(key)
    log(message)
  }
}

let listening = false
export const listenForCspViolations = () => {
  if (listening) return
  listening = true
  const onViolation = makeCspViolationLogger(message => logger.warn(message))
  document.addEventListener('securitypolicyviolation', onViolation)
}
