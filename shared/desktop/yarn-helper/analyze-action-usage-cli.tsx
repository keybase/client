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
    const usedActions = usageMap.get(ns) || new Set()
    const unusedActions = allActions.filter(a => !usedActions.has(a))
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📦 ${ns}`)
    console.log(`${'='.repeat(60)}`)
    console.log(`Total actions: ${allActions.length}`)
    console.log(`Used: ${usedActions.size} (${Math.round((usedActions.size / allActions.length) * 100)}%)`)
    console.log(`Unused: ${unusedActions.length} (${Math.round((unusedActions.length / allActions.length) * 100)}%)`)
    
    if (unusedActions.length > 0) {
      console.log(`\n❌ Would be filtered out:`)
      unusedActions.slice(0, 10).forEach(a => console.log(`   - ${a}`))
      if (unusedActions.length > 10) {
        console.log(`   ... and ${unusedActions.length - 10} more`)
      }
    }
    
    if (usedActions.size > 0) {
      console.log(`\n✅ Would be kept:`)
      Array.from(usedActions)
        .slice(0, 10)
        .forEach(a => console.log(`   - ${a}`))
      if (usedActions.size > 10) {
        console.log(`   ... and ${usedActions.size - 10} more`)
      }
    }
  }
  
  console.log('\n\n📊 Summary:')
  const totals = files.reduce(
    (acc, file) => {
      const ns = path.basename(file, '.json')
      const desc = json5.parse(fs.readFileSync(path.join(jsonDir, file), 'utf8'))
      const allActions = Object.keys(desc.actions).length
      const usedActions = (usageMap.get(ns) || new Set()).size
      return {
        total: acc.total + allActions,
        used: acc.used + usedActions,
      }
    },
    {total: 0, used: 0}
  )
  
  console.log(`Total actions across all files: ${totals.total}`)
  console.log(`Actions that would be generated: ${totals.used}`)
  console.log(`Actions that would be filtered: ${totals.total - totals.used}`)
  console.log(
    `Reduction: ${Math.round(((totals.total - totals.used) / totals.total) * 100)}%`
  )
  
  console.log('\n💡 To regenerate with filtering, run: yarn build-actions')
}

main()
  .then(() => {})
  .catch((e: unknown) => {
    console.error('Error:', e)
    process.exit(1)
  })

