// +build windows

package pinentry

func HasWindows() bool {
	// We're assuming you aren't using windows remotely.
	return true
}
