// Package gomounts implements a cross-platform library for retrieving
// mounted filesystem volumes.
//
// Author: Clint Caywood
//
// https://github.com/cratonica/gomounts
package gomounts

// Represents a mounted volume on the host system
type Volume struct {
	Path  string // The mount point of the volume
	Type  string // The filesystem type
	Owner string
}

// Gets a slice of all volumes that are currently
// mounted on the host system.
func GetMountedVolumes() ([]Volume, error) {
	return getMountedVolumes() // Calls platform-specific implementation
}
