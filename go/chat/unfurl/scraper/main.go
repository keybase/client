package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/keybase/client/go/chat/unfurl"
	"github.com/keybase/client/go/logger"
	logging "github.com/keybase/go-logging"
)

func main() {
	flag.Parse()
	args := flag.Args()
	if len(args) != 1 {
		fmt.Printf("must supply a URL\n")
		os.Exit(3)
	}

	logger := logger.New("scraper")
	logging.Reset()
	url := args[0]
	scraper := unfurl.NewScraper(logger)
	res, err := scraper.Scrape(context.TODO(), url, nil)
	if err != nil {
		fmt.Printf("error scraping URL: %v\n", err)
		os.Exit(3)
	}
	fmt.Printf("%s\n", res.UnsafeDebugString())
}
