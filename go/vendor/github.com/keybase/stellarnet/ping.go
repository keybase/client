package stellarnet

import (
	"fmt"

	"github.com/stellar/go/clients/horizon"
)

// HorizonRoot returns the root information from the horizon
// server.
func HorizonRoot() (horizon.Root, error) {
	return Client().Root()
}

// Ping returns a formatted string of info about the horizon server
// that stellarnet is connected to.
func Ping() (string, error) {
	root, err := HorizonRoot()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("horizon ver: %s, stellar-core ver: %s, horizon seqno: %d, core seqno: %d", root.HorizonVersion, root.StellarCoreVersion, root.HorizonSequence, root.CoreSequence), nil
}
