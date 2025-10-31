#!/usr/bin/env node
import path from 'path'
import json5 from 'json5'
import fs from 'fs'
import {analyzeAndReport} from './analyze-action-usage'

/**
 * CLI tool to analyze action usage and show what would be filtered
 * Usage: yarn _node desktop/yarn-helper/analyze-action-usage-cli.tsx
 */

async function main() {
  const rootDir = path.join(__dirname, '../..')
  const jsonDir = path.join(rootDir, 'actions/json')
  
  console.log('🔍 Analyzing action usage...\n')
  const usageMap = analyzeAndReport(rootDir)
  
  console.log('\n📋 Detailed Report:\n')
  
  const files = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'))
  
  for (const file of files) {
    const ns = path.basename(file, '.json')
    const desc = json5.parse(fs.readFileSync(path.join(jsonDir, file), 'utf8'))
    const allActions = Object.keys(desc.actions)
    const usedActionsMap = usageMap.get(ns) || new Map()
    const unusedActions = allActions.filter(a => !usedActionsMap.has(a))
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📦 ${ns}`)
    console.log(`${'='.repeat(60)}`)
    console.log(`Total actions: ${allActions.length}`)
    console.log(`Used: ${usedActionsMap.size} (${Math.round((usedActionsMap.size / allActions.length) * 100)}%)`)
    console.log(`Unused: ${unusedActions.length} (${Math.round((unusedActions.length / allActions.length) * 100)}%)`)
    
    // Count granular usage
    let creatorsSkipped = 0
    for (const usage of usedActionsMap.values()) {
      if (!usage.creator) creatorsSkipped++
    }
    if (creatorsSkipped > 0) {
      console.log(`\n💡 Optimization: ${creatorsSkipped} creators will be skipped (constant-only usage)`)
    }
    
    if (unusedActions.length > 0) {
      console.log(`\n❌ Would be filtered out:`)
      unusedActions.slice(0, 10).forEach(a => console.log(`   - ${a}`))
      if (unusedActions.length > 10) {
        console.log(`   ... and ${unusedActions.length - 10} more`)
      }
    }
    
    if (usedActionsMap.size > 0) {
      console.log(`\n✅ Would be kept (with usage):`)
      Array.from(usedActionsMap.entries())
        .slice(0, 10)
        .forEach(([action, usage]) => {
          const parts = []
          if (usage.constant) parts.push('const')
          if (usage.creator) parts.push('creator')
          if (usage.payloadType) parts.push('payload')
          console.log(`   - ${action} [${parts.join(', ')}]`)
        })
      if (usedActionsMap.size > 10) {
        console.log(`   ... and ${usedActionsMap.size - 10} more`)
      }
    }
  }
  
  console.log('\n\n📊 Summary:')
  const totals = files.reduce(
    (acc, file) => {
      const ns = path.basename(file, '.json')
      const desc = json5.parse(fs.readFileSync(path.join(jsonDir, file), 'utf8'))
      const allActions = Object.keys(desc.actions).length
      const usedActionsMap = usageMap.get(ns) || new Map()
      const usedActions = usedActionsMap.size
      let creatorsSkipped = 0
      for (const usage of usedActionsMap.values()) {
        if (!usage.creator) creatorsSkipped++
      }
      return {
        total: acc.total + allActions,
        used: acc.used + usedActions,
        creatorsSkipped: acc.creatorsSkipped + creatorsSkipped,
      }
    },
    {total: 0, used: 0, creatorsSkipped: 0}
  )
  
  console.log(`Total actions across all files: ${totals.total}`)
  console.log(`Actions that would be generated: ${totals.used}`)
  console.log(`Actions that would be filtered: ${totals.total - totals.used}`)
  console.log(`Reduction: ${Math.round(((totals.total - totals.used) / totals.total) * 100)}%`)
  console.log(`\n💾 Additional savings: ${totals.creatorsSkipped} creator types skipped (constant-only usage)`)
  
  console.log('\n💡 To regenerate with filtering, run: yarn build-actions')
}

main()
  .then(() => {})
  .catch((e: unknown) => {
    console.error('Error:', e)
    process.exit(1)
  })

