package config

import "fmt"

// ErrInvalidPermissions is returned when an invalid permissions string appears
// in the config.
type ErrInvalidPermissions struct {
	permissions string
}

// Error implements the error interface.
func (e ErrInvalidPermissions) Error() string {
	return "invalid permission(s) " + e.permissions
}

// ErrDuplicatePerPathConfigPath is returned when multiple per-user configs are
// defined for the same path in config.
type ErrDuplicatePerPathConfigPath struct {
	cleanedPath string
}

// Error implements the error interface.
func (e ErrDuplicatePerPathConfigPath) Error() string {
	return "duplicate access control for " + e.cleanedPath
}

// ErrInvalidVersion is returned when Version field of the config is invalid.
type ErrInvalidVersion struct {
	versionStr string
}

// Error implements the error interface.
func (e ErrInvalidVersion) Error() string {
	return fmt.Sprintf("invalid version %s", e.versionStr)
}

// ErrUndefinedUsername is returned when a username appears in a per-path
// config but it's not defined in the config's Users section.
type ErrUndefinedUsername struct {
	username string
}

// Error implements the error interface.
func (e ErrUndefinedUsername) Error() string {
	return fmt.Sprintf("undefined username %s", e.username)
}

// ErrACLsPerPathConfigsBothPresent is returned when we are parsing a ConfigV1
// that has both ACLs and PerPathConfigs defined.
type ErrACLsPerPathConfigsBothPresent struct{}

// Error implements the error interface.
func (ErrACLsPerPathConfigsBothPresent) Error() string {
	return "We are deprecating `acls` and moving to `per_path_configs`. " +
		"Please use `per_path_configs`."
}

// ErrInvalidConfig is returned when an invalid config is provided.
type ErrInvalidConfig struct {
	msg string
}

// Error implements the error interface.
func (e ErrInvalidConfig) Error() string {
	return fmt.Sprintf("invalid config: %s", e.msg)
}
