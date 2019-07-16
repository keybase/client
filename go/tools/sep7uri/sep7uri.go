package main

import (
	"flag"
	"fmt"
	"net/url"
	"os"

	"github.com/keybase/stellarnet"
)

var destination string
var amount string
var assetCode string
var assetIssuer string
var key string
var domain string
var message string
var xdr string
var memo string
var memoType string

func main() {
	parseFlags()
	uri := run()
	fmt.Println(uri)
}

func parseFlags() {
	flag.StringVar(&destination, "to", "", "destination stellar address")
	flag.StringVar(&destination, "t", "", "destination stellar address (shorthand)")
	flag.StringVar(&amount, "amount", "", "number of XLM to send to destination")
	flag.StringVar(&amount, "a", "", "number of XLM to send to destination (shorthand)")
	flag.StringVar(&key, "key", "", "secret stellar key for signing")
	flag.StringVar(&key, "k", "", "secret stellar key for signing (shorthand)")
	flag.StringVar(&domain, "domain", "", "origin domain for the request")
	flag.StringVar(&domain, "d", "", "origin domain for the request (shorthand)")
	flag.StringVar(&message, "message", "", "message to include")
	flag.StringVar(&message, "m", "", "message to include (shorthand)")
	flag.StringVar(&xdr, "xdr", "", "base64-encoded xdr transaction envelope")
	flag.StringVar(&memo, "memo", "", "public memo")
	flag.StringVar(&memoType, "memo-type", "", "MEMO_TEXT, MEMO_ID, MEMO_HASH, MEMO_RETURN")
	flag.StringVar(&assetCode, "asset-code", "", "destination asset code")
	flag.StringVar(&assetIssuer, "asset-issuer", "", "destination asset issuer")

	flag.Parse()

	if xdr != "" {
		if destination != "" {
			fmt.Fprintln(os.Stderr, "cannot specify xdr and destination")
			flag.PrintDefaults()
			os.Exit(1)
		}
		if amount != "" {
			fmt.Fprintln(os.Stderr, "cannot specify xdr and amount")
			flag.PrintDefaults()
			os.Exit(1)
		}
	} else if destination == "" {
		fmt.Fprintln(os.Stderr, "destination or xdr is required")
		flag.PrintDefaults()
		os.Exit(1)
	}

	if key == "" || domain == "" {
		fmt.Fprintln(os.Stderr, "key and domain are required")
		flag.PrintDefaults()
		os.Exit(1)
	}

	if memo != "" && memoType == "" {
		memoType = "MEMO_TEXT"
	}
}

func run() string {
	var op string
	if xdr != "" {
		op = "tx"
	} else {
		op = "pay"
	}

	u, err := url.Parse("web+stellar:" + op)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	q := u.Query()
	q.Set("origin_domain", domain)
	if message != "" {
		q.Set("msg", message)
	}

	switch op {
	case "pay":
		q.Set("destination", destination)
		if amount != "" {
			q.Set("amount", amount)
		}
		if memo != "" {
			q.Set("memo", memo)
			q.Set("memo_type", memoType)
		}
		if assetCode != "" && assetIssuer != "" {
			q.Set("asset_code", assetCode)
			q.Set("asset_issuer", assetIssuer)
		}
	case "tx":
		q.Set("xdr", xdr)
	}

	u.RawQuery = q.Encode()

	seed, err := stellarnet.NewSeedStr(key)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	signed, _, err := stellarnet.SignStellarURI(u.String(), seed)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	return signed
}
