//go:build darwin && !ios && !android
// +build darwin,!ios,!android

package attachments

/*
#cgo LDFLAGS: -framework CoreServices
*/
import "C"
