package teams

import "time"

// Default values for the UIDMapper. See comments in libkb/interfaces.go for
// MapUIDsToUsernamePackages
const defaultFullnameFreshness = 24 * time.Hour
const defaultNetworkTimeBudget = 0
