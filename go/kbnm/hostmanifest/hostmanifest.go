package hostmanifest

import "os/user"

// AppManifest is a serializable App metadata container
type AppManifest interface {
	// ID returns the app identifier, usually the same as the name.
	ID() string
	// Bin returns the path of the binary for the NativeMessaging app target.
	BinPath() string
}

// App contains the metadata that defines a NativeMessaging app.
type App struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Path        string `json:"path"`
	Type        string `json:"type"`
}

// ID returns the app identifier
func (app App) ID() string {
	return app.Name
}

// Bin returns the path of the binary for the NativeMessaging app target.
func (app App) BinPath() string {
	return app.Path
}

// ChromeApp is the App metadata but includes Chrome-specific fields.
type ChromeApp struct {
	App
	AllowedOrigins []string `json:"allowed_origins"`
}

// ChromeApp is the App metadata but includes Firefox-specific fields.
type FirefoxApp struct {
	App
	AllowedExtensions []string `json:"allowed_extensions"`
}

// Installer handles writing whitelist information for enabling the
// NativeMessaging app.
type Installer interface {
	Install(u *user.User, app AppManifest) error
	Uninstall(u *user.User, app AppManifest) error
}
