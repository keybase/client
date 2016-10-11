// @flow
import fs from 'fs'

// Allow for callers to change execution directory
if (process.argv[2] && process.argv[2].indexOf('-') !== 0) {
  process.chdir(process.argv[2])
}

// Add verbose option for debugging
const VERBOSE = process.argv.slice(2).some((arg) => ['-v', '--verbose'].indexOf(arg) !== -1)

const dependencyFiles = ['package.json', 'npm-shrinkwrap.json']

// Ensure that package.json and npm-shrinkwrap.json exist then load them
const [pack, shrinkwrap] = dependencyFiles.map((filePath) => {
  if (!fs.statSync(filePath).isFile()) {
    throw new Error(`${filePath} does not exist`)
  }
  return JSON.parse(fs.readFileSync(filePath, {encoding: 'utf-8'}))
})

// Ensure that the package files have dependency fields
if (!pack['dependencies']) {
  throw new Error('package.json has no "dependencies" entry')
}
if (!shrinkwrap['dependencies']) {
  throw new Error('npm-shrinkwrap.json has no "dependencies" entry')
}

// Begin comparing dependency entries for any discrepencies
const discrepencies = Object.keys(pack['dependencies']).reduce((discrepencies, dependencyName) => {
  if (VERBOSE) process.stdout.write(`Checking ${dependencyName}: `)
  const shrinkwrapEntry = shrinkwrap['dependencies'][dependencyName]
  // Check that npm-shrinkwrap.json an an entry for this dependency
  if (!shrinkwrapEntry) {
    if (VERBOSE) process.stdout.write('NOT FOUND \n')
    return discrepencies.concat({
      name: dependencyName,
      type: 'NOT FOUND',
      message: 'missing in npm-shrinkwrap.json dependencies',
    })
  }
  // Check that package.json and npm-shrinkwrap.json have matching version of the dependency
  const dependencyVersion = pack['dependencies'][dependencyName]
  const shrinkwrapVersion = /^[a-zA-Z]/.test(dependencyVersion) ? shrinkwrapEntry.resolved : shrinkwrapEntry.version
  if (dependencyVersion !== shrinkwrapVersion) {
    if (VERBOSE) process.stdout.write('WRONG VERSION \n')
    return discrepencies.concat({
      name: dependencyName,
      type: 'WRONG VERSION',
      message: `package.json has version "${dependencyVersion}" while npm-shrinkwrap.json has "${shrinkwrapVersion}"`,
    })
  }
  if (VERBOSE) process.stdout.write('\u2713\n')
  return discrepencies
}, [])

// Print any discrepency output and fail
console.log(`\nChecked ${Object.keys(pack['dependencies']).length} dependencies and found ${discrepencies.length || 'no'} problems!\n`)
if (discrepencies.length > 0) {
  discrepencies.forEach((discrepency) => {
    console.error(`${discrepency.type}: ${discrepency.name} - ${discrepency.message}`)
  })
  process.exit(1)
}
