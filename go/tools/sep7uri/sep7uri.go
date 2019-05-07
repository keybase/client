package main

import (
	"flag"
	"fmt"
	"net/url"
	"os"

	"github.com/keybase/stellarnet"
)

func main() {
	var destination string
	var amount string
	var key string
	var domain string
	var message string

	flag.StringVar(&destination, "to", "", "destination stellar address")
	flag.StringVar(&destination, "t", "", "destination stellar address (shorthand)")
	flag.StringVar(&amount, "amount", "", "number of XLM to send to destination")
	flag.StringVar(&amount, "a", "", "number of XLM to send to destination (shorthand)")
	flag.StringVar(&key, "key", "", "secret stellar key for signing")
	flag.StringVar(&key, "k", "", "secret stellar key for signing (shorthand)")
	flag.StringVar(&domain, "domain", "", "origin domain for the request")
	flag.StringVar(&domain, "d", "", "origin domain for the request (shorthand)")
	flag.StringVar(&message, "message", "", "message to include")
	flag.StringVar(&domain, "m", "", "message to include (shorthand)")

	flag.Parse()

	if destination == "" || key == "" || domain == "" {
		flag.PrintDefaults()
		os.Exit(1)
	}

	seed, err := stellarnet.NewSeedStr(key)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	u, err := url.Parse("web+stellar:pay")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	q := u.Query()
	q.Set("destination", destination)
	q.Set("origin_domain", domain)
	if amount != "" {
		q.Set("amount", amount)
	}
	if message != "" {
		q.Set("msg", message)
	}
	u.RawQuery = q.Encode()

	signed, _, err := stellarnet.SignStellarURI(u.String(), seed)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println(signed)
}
