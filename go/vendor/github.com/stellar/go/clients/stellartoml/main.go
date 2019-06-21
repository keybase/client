package stellartoml

import "net/http"

// StellarTomlMaxSize is the maximum size of stellar.toml file
const StellarTomlMaxSize = 100 * 1024

// WellKnownPath represents the url path at which the stellar.toml file should
// exist to conform to the federation protocol.
const WellKnownPath = "/.well-known/stellar.toml"

// DefaultClient is a default client using the default parameters
var DefaultClient = &Client{HTTP: http.DefaultClient}

// Client represents a client that is capable of resolving a Stellar.toml file
// using the internet.
type Client struct {
	// HTTP is the http client used when resolving a Stellar.toml file
	HTTP HTTP

	// UseHTTP forces the client to resolve against servers using plain HTTP.
	// Useful for debugging.
	UseHTTP bool
}

type ClientInterface interface {
	GetStellarToml(domain string) (*Response, error)
	GetStellarTomlByAddress(addy string) (*Response, error)
}

// HTTP represents the http client that a stellertoml resolver uses to make http
// requests.
type HTTP interface {
	Get(url string) (*http.Response, error)
}

// Response represents the results of successfully resolving a stellar.toml file
type Response struct {
	AuthServer       string `toml:"AUTH_SERVER"`
	FederationServer string `toml:"FEDERATION_SERVER"`
	EncryptionKey    string `toml:"ENCRYPTION_KEY"`
	SigningKey       string `toml:"SIGNING_KEY"`
}

// GetStellarToml returns stellar.toml file for a given domain
func GetStellarToml(domain string) (*Response, error) {
	return DefaultClient.GetStellarToml(domain)
}

// GetStellarTomlByAddress returns stellar.toml file of a domain fetched from a
// given address
func GetStellarTomlByAddress(addy string) (*Response, error) {
	return DefaultClient.GetStellarTomlByAddress(addy)
}
