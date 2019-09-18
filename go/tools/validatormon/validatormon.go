package main

import (
	"errors"
	"log"
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

var kbNodes = []string{"keybase1", "keybase2", "keybase3"}
var cmpNodes = []string{"sdf1", "sdf2", "sdf3"}

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
	if a.LedgerDelta < 10 && a.Phase == "EXTERNALIZE" {
		a.Ok = true
	}

	return &a, nil
}

func main() {
}
