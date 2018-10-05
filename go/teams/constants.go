package teams

import "time"

// Default values for the UIDMapper. See comments in libkb/interfaces.go for
// MapUIDsToUsernamePackages
const defaultFullnameFreshness = 10 * time.Minute
const defaultNetworkTimeBudget = 0
