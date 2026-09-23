//go:build race

package maps

// raceEnabled lets a race-only test skip itself when the binary wasn't built
// with -race, instead of running (uselessly) under the normal detector-free
// build.
const raceEnabled = true
