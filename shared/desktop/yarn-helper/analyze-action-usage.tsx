import fs from 'fs'
import path from 'path'

type ActionUsage = {
  constant: boolean // The action constant (e.g., openChatFromWidget)
  creator: boolean // The action creator (e.g., createOpenChatFromWidget)
  payloadType: boolean // The payload type (e.g., OpenChatFromWidgetPayload)
}

type UsageMap = Map<string, Map<string, ActionUsage>> // namespace -> action name -> usage details

/**
 * Scans TypeScript files to find which actions are actually used in the codebase
 */
export function analyzeActionUsage(rootDir: string): UsageMap {
  const usageMap: UsageMap = new Map()
  const extensions = ['.ts', '.tsx', '.js', '.jsx']

  function scanDirectory(dir: string) {
    const entries = fs.readdirSync(dir, {withFileTypes: true})

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      // Skip node_modules, dist, build, etc.
      if (
        entry.isDirectory() &&
        !['node_modules', 'dist', 'build', '.git', 'coverage'].includes(entry.name)
      ) {
        scanDirectory(fullPath)
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        // Skip generated files themselves
        if (entry.name.endsWith('-gen.tsx') || entry.name.endsWith('-gen.ts')) {
          continue
        }
        scanFile(fullPath)
      }
    }
  }

  function scanFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf8')

    // Pattern 1: Import from generated files (including type imports)
    // import * as RemoteGen from '@/actions/remote-gen'
    // import {createOpenChatFromWidget} from '@/actions/remote-gen'
    // import type {OpenChatFromWidgetPayload} from '@/actions/remote-gen'
    // Note: handles engine-gen-gen.tsx -> engine-gen namespace mapping
    const importRegex =
      /import\s+(?:type\s+)?(?:{([^}]+)}|\*\s+as\s+(\w+))\s+from\s+['"][@./]*actions\/([\w-]+?)(?:-gen)?['"]/g
    let match

    while ((match = importRegex.exec(content)) !== null) {
      const namedImports = match[1]
      const namespaceImport = match[2]
      const namespace = match[3] // e.g., 'remote', 'engine-gen' (strips trailing -gen)

      if (!namespace) continue

      if (namedImports) {
        // Parse named imports: {createX, createY, XxxPayload, Actions}
        const imports = namedImports.split(',').map(i => i.trim())
        for (const imp of imports) {
          // Extract action name from createXxx
          if (imp.startsWith('create')) {
            const actionName = decapitalize(imp.slice(6)) // remove 'create'
            addUsage(namespace, actionName, 'creator')
          }
          // Extract action name from XxxPayload types
          else if (imp.endsWith('Payload')) {
            const actionName = decapitalize(imp.slice(0, -7)) // remove 'Payload'
            addUsage(namespace, actionName, 'payloadType')
          }
          // Also check for constant imports like 'openChatFromWidget'
          else if (!imp.endsWith('Actions') && imp !== 'Actions') {
            addUsage(namespace, imp, 'constant')
          }
        }
      } else if (namespaceImport) {
        // Namespace import - scan for usage patterns
        // RemoteGen.createX, RemoteGen.openChatFromWidget, RemoteGen.XxxPayload
        const nsPattern = new RegExp(`\\b${namespaceImport}\\.(?:create(\\w+)|(\\w+)Payload|(\\w+))\\b`, 'g')
        let nsMatch
        while ((nsMatch = nsPattern.exec(content)) !== null) {
          const actionFromCreate = nsMatch[1]
          const actionFromPayload = nsMatch[2]
          const actionDirect = nsMatch[3]

          if (actionFromCreate) {
            addUsage(namespace, decapitalize(actionFromCreate), 'creator')
          } else if (actionFromPayload) {
            addUsage(namespace, decapitalize(actionFromPayload), 'payloadType')
          } else if (actionDirect && !['Actions', 'resetStore', 'typePrefix'].includes(actionDirect)) {
            addUsage(namespace, actionDirect, 'constant')
          }
        }
      }
    }

    // Pattern 2: Action type string literals (for saga listeners, reducers, etc.)
    // case 'remote:openChatFromWidget':
    // type: 'remote:openChatFromWidget'
    const typeStringRegex = /['"](\w+):(\w+)['"]/g
    while ((match = typeStringRegex.exec(content)) !== null) {
      const namespace = match[1]
      const actionName = match[2]
      if (namespace && actionName !== 'resetStore' && actionName) {
        addUsage(namespace, actionName, 'constant')
      }
    }

    // Pattern 3: ReturnType usage
    // ReturnType<typeof RemoteGen.createX>
    // ReturnType<typeof createX>
    const returnTypeRegex = /ReturnType<typeof\s+(?:(\w+)\.)?create(\w+)>/g
    while ((match = returnTypeRegex.exec(content)) !== null) {
      // Try to infer namespace from context if not explicit
      const actionName = decapitalize(match[2] ?? '')
      // If we have a namespace import, we would have caught it above
      // This is mainly for local imports
      const localCreateRegex = new RegExp(
        `import\\s+{[^}]*create${match[2]}[^}]*}\\s+from\\s+['"][@./]*actions/(\\w+)-gen['"]`
      )
      const localMatch = localCreateRegex.exec(content)
      if (localMatch?.[1]) {
        addUsage(localMatch[1], actionName, 'payloadType') // ReturnType means we need the payload type
      }
    }

    // Note: We do NOT track RPC method name usage like 'chat.1.chatUi.chatThreadCached'
    // because those are internal to the RPC system and don't actually import/use the
    // generated TypeScript code. They just need the action to exist in the protocol.
  }

  function addUsage(namespace: string, actionName: string, part: 'constant' | 'creator' | 'payloadType') {
    if (!usageMap.has(namespace)) {
      usageMap.set(namespace, new Map())
    }
    const namespaceMap = usageMap.get(namespace)!
    if (!namespaceMap.has(actionName)) {
      namespaceMap.set(actionName, {constant: false, creator: false, payloadType: false})
    }
    const usage = namespaceMap.get(actionName)!
    usage[part] = true
  }

  function decapitalize(s: string): string {
    return s.charAt(0).toLowerCase() + s.slice(1)
  }

  scanDirectory(rootDir)
  return usageMap
}

/**
 * Filters action JSON to include used actions with usage metadata
 */
export function filterActions(
  namespace: string,
  actionJson: {prelude: string[]; actions: Record<string, unknown>},
  usageMap: UsageMap
): {prelude: string[]; actions: Record<string, any>} {
  const usedActionsMap = usageMap.get(namespace)

  // If no usage found, keep everything (safe default)
  if (!usedActionsMap || usedActionsMap.size === 0) {
    console.warn(
      `⚠️  No usage found for ${namespace} - generating all actions (this might be a false negative)`
    )
    return actionJson
  }

  const filteredActions: Record<string, any> = {}
  let filteredCount = 0

  for (const [actionName, actionDesc] of Object.entries(actionJson.actions)) {
    const usage = usedActionsMap.get(actionName)
    if (usage) {
      // Attach usage metadata to the action descriptor
      filteredActions[actionName] = {...(actionDesc as object), _usage: usage}
    } else {
      filteredCount++
    }
  }

  // Filter prelude imports - only keep imports that are actually used by remaining actions
  const actionDescriptions = Object.values(filteredActions)
    .map(desc => JSON.stringify(desc))
    .join(' ')

  const filteredPrelude = actionJson.prelude.filter(importLine => {
    // Extract the type name from: import type * as chat1Types from '...'
    const typeMatch = importLine.match(/import\s+type\s+\*\s+as\s+(\w+)/)
    if (!typeMatch) return true // Keep non-type imports

    const typeName = typeMatch[1]
    // Check if this type is used in any remaining action
    return actionDescriptions.includes(typeName ?? '')
  })

  console.log(
    `📊 ${namespace}: keeping ${Object.keys(filteredActions).length}/${Object.keys(actionJson.actions).length} actions (filtered ${filteredCount})`
  )

  return {
    actions: filteredActions,
    prelude: filteredPrelude,
  }
}

/**
 * Main function to analyze and report
 */
export function analyzeAndReport(rootDir: string): UsageMap {
  console.log('🔍 Analyzing action usage in codebase...\n')
  const usageMap = analyzeActionUsage(rootDir)

  console.log('📈 Usage Summary:')
  for (const [namespace, actions] of usageMap.entries()) {
    const counts = {constant: 0, creator: 0, payloadType: 0}
    for (const usage of actions.values()) {
      if (usage.constant) counts.constant++
      if (usage.creator) counts.creator++
      if (usage.payloadType) counts.payloadType++
    }
    console.log(
      `  ${namespace}: ${actions.size} actions (const: ${counts.constant}, creator: ${counts.creator}, payload: ${counts.payloadType})`
    )
  }
  console.log()

  return usageMap
}
