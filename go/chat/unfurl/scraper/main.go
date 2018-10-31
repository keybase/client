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
	_, err := scraper.Scrape(context.TODO(), url)
	if err != nil {
		fmt.Printf("error scraping URL: %s\n", err)
		os.Exit(3)
	}
}
