// +build ios android

package install

// TerminateApp is Used on desktop to kill the app, doesn't apply on mobile
func TerminateApp(context Context, log Log) error {
	return nil
}
