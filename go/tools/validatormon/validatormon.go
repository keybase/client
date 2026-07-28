package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"os"
	"strings"
	"time"

	showtrends "github.com/keybase/showtrends-sdk/go"
)

// this is a tool to monitor stellar validators.

var nodes = map[string]string{
	"keybase1": "GCWJKM4EGTGJUVSWUJDPCQEOEP5LHSOFKSA4HALBTOO4T4H3HCHOM6UX",
	"keybase2": "GDKWELGJURRKXECG3HHFHXMRX64YWQPUHKCVRESOX3E5PM6DM4YXLZJM",
	"keybase3": "GA35T3723UP2XJLC2H7MNL6VMKZZIFL2VW7XHMFFJKKIA2FJCYTLKFBW",
	"sdf1":     "GCGB2S2KGYARPVIA37HYZXVRM2YZUEXA6S33ZU5BUDC6THSB62LZSTYH",
	"sdf2":     "GCM6QMP3DLRPTAZW2UZPCPX2LF3SXWXKPMP3GKFZBDSF3QZGV2G5QSTK",
	"sdf3":     "GABMKJM6I25XI4K7U6XWMULOUQIQ27BCTMLS6BYYSOWKTBUXVRJSXHYQ",
}

var (
	kbNodes  = []string{"keybase1", "keybase2", "keybase3"}
	cmpNodes = []string{"sdf1", "sdf2", "sdf3"}
)

type Status struct {
	Node    string
	Ledger  int
	Phase   string
	Missing []string
}

type StatusReader interface {
	StatusRead(accountID string) (*Status, error)
}

func CompareLedger(sr StatusReader) int {
	var maxLedger int

	for _, n := range cmpNodes {
		status, err := sr.StatusRead(nodes[n])
		if err != nil {
			log.Printf("StatusRead error for %s (%s): %s", n, nodes[n], err)
			continue
		}
		if status.Ledger > maxLedger {
			maxLedger = status.Ledger
		}
	}

	return maxLedger
}

type Analysis struct {
	LedgerDelta  int
	Phase        string
	MissingCount int
	Ok           bool
	LedgerBehind bool
	BadPhase     bool
}

func AnalyzeNode(sr StatusReader, nodeName string) (*Analysis, error) {
	cl := CompareLedger(sr)
	if cl == 0 {
		return nil, errors.New("all compare nodes returning 0 ledger")
	}

	status, err := sr.StatusRead(nodes[nodeName])
	if err != nil {
		return nil, err
	}

	var a Analysis
	a.LedgerDelta = cl - status.Ledger
	a.Phase = status.Phase
	a.MissingCount = len(status.Missing)
	/*
		if a.LedgerDelta < 10 && a.Phase == "EXTERNALIZE" {
			a.Ok = true
		} else {
			if a.LedgerDelta >= 10 {
				a.LedgerBehind = true
			}
			if a.Phase != "EXTERNALIZE" {
				a.BadPhase = true
			}
		}
	*/
	// phase looks like it can be all over the place...will just check ledger
	if a.LedgerDelta < 10 {
		a.Ok = true
	} else {
		a.LedgerBehind = true
	}

	return &a, nil
}

var (
	showtrendsAddr   string
	showtrendsClient *showtrends.Client
)

func main() {
	log.Printf("validatormon starting")
	parseFlags()
	if showtrendsAddr != "" {
		showtrendsClient = showtrends.NewClient(
			showtrendsAddr, "keybase", showtrends.DefaultBatchInterval)
	}
	analyzeNodes()
	if showtrendsClient != nil {
		closeShowtrendsClient()
	}
	log.Printf("validatormon finished")
}

func parseFlags() {
	flag.StringVar(&showtrendsAddr, "showtrends-addr",
		os.Getenv("SHOWTRENDS_ADDR"), "showtrends server address")
	flag.Parse()
	if showtrendsAddr == "" {
		log.Printf("no showtrends address provided, proceeding but no stats will be reported")
	}
}

func closeShowtrendsClient() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := showtrendsClient.Close(ctx); err != nil {
		log.Printf("showtrends close error: %s", err)
	}
}

func analyzeNodes() {
	sr := new(LocalReader)
	for _, n := range kbNodes {
		a, err := AnalyzeNode(sr, n)
		if err != nil {
			log.Printf("AnalyzeNode %s (%s) error: %s", n, nodes[n], err)
			postCount("monitor error~total," + n)
			continue
		}

		if a.Ok {
			log.Printf("node %s is ok", n)
			postCount("ok~total," + n)
		} else {
			log.Printf("node %s is not ok (%+v)", n, a)
			pieces := []string{"total"}
			if a.BadPhase {
				pieces = append(pieces, "bad phase")
			}
			if a.LedgerBehind {
				pieces = append(pieces, "ledger behind")
			}
			pieces = append(pieces, n)
			postCount("not ok~" + strings.Join(pieces, ","))
		}

		log.Printf("node %s missing count: %d", n, a.MissingCount)
		postValue("missing count~all,"+n, a.MissingCount)

		log.Printf("node %s ledger delta: %d", n, a.LedgerDelta)
		postValue("ledger delta~all,"+n, a.LedgerDelta)
	}
}

const statPrefix = "stellar - validator - "

func postCount(name string) {
	if showtrendsClient == nil {
		return
	}
	showtrendsClient.CountOne(statPrefix + name)
}

func postValue(name string, v int) {
	if showtrendsClient == nil {
		return
	}
	showtrendsClient.Value(statPrefix+name, float64(v))
}
