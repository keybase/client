package main

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

type mockSR struct{}

func (m *mockSR) StatusRead(accountID string) (*Status, error) {
	switch accountID {
	case "GCWJKM4EGTGJUVSWUJDPCQEOEP5LHSOFKSA4HALBTOO4T4H3HCHOM6UX":
		return &Status{Ledger: 9999, Phase: "EXTERNALIZE"}, nil
	case "GDKWELGJURRKXECG3HHFHXMRX64YWQPUHKCVRESOX3E5PM6DM4YXLZJM":
		return &Status{Ledger: 9999, Phase: "Sync"}, nil
	case "GA35T3723UP2XJLC2H7MNL6VMKZZIFL2VW7XHMFFJKKIA2FJCYTLKFBW":
		return &Status{Ledger: 9980, Phase: "EXTERNALIZE"}, nil
	case "GCGB2S2KGYARPVIA37HYZXVRM2YZUEXA6S33ZU5BUDC6THSB62LZSTYH":
		return &Status{Ledger: 9999}, nil
	case "GCM6QMP3DLRPTAZW2UZPCPX2LF3SXWXKPMP3GKFZBDSF3QZGV2G5QSTK":
		return &Status{Ledger: 10000}, nil
	case "GABMKJM6I25XI4K7U6XWMULOUQIQ27BCTMLS6BYYSOWKTBUXVRJSXHYQ":
		return &Status{Ledger: 9997}, nil
	default:
		return nil, errors.New("unknown account id")
	}
}

func TestCompareLedger(t *testing.T) {
	n := CompareLedger(new(mockSR))
	if n != 10000 {
		require.Fail(t, "CompareLedger: %d, expected 10000", n)
	}
}

func TestAnalyzeNode(t *testing.T) {
	a, err := AnalyzeNode(new(mockSR), "keybase1")
	require.NoError(t, err)
	if !a.Ok {
		require.Fail(t, "keybase1 not ok, expected ok: %+v", a)
	}

	a, err = AnalyzeNode(new(mockSR), "keybase2")
	require.NoError(t, err)
	// this was a bad phase check, which we are ignoring now
	/*
		if a.Ok {
			require.Fail(t, "keybase2 ok, expected not ok: %+v", a)
		}
	*/
	if !a.Ok {
		require.Fail(t, "keybase2 not ok, expected ok: %+v", a)
	}

	a, err = AnalyzeNode(new(mockSR), "keybase3")
	require.NoError(t, err)
	if a.Ok {
		require.Fail(t, "keybase3 ok, expected not ok: %+v", a)
	}
}

func TestStatusFromJSON(t *testing.T) {
	s, err := statusFromJSON([]byte(lbRes))
	require.NoError(t, err)
	if s.Node != "lobstr3" {
		require.Fail(t, "node: %q, expected lobstr3", s.Node)
	}
	if s.Ledger != 25889124 {
		require.Fail(t, "ledger: %d, expected 25889124", s.Ledger)
	}
	if s.Phase != "expired" {
		require.Fail(t, "phase: %q, expected expired", s.Phase)
	}
	if len(s.Missing) != 0 {
		require.Fail(t, "missing len: %d, expected 0", len(s.Missing))
	}

	s, err = statusFromJSON([]byte(kbRes))
	require.NoError(t, err)
	if s.Node != "keybase2" {
		require.Fail(t, "node: %q, expected keybase2", s.Node)
	}
	if s.Ledger != 25889136 {
		require.Fail(t, "ledger: %d, expected 25889136", s.Ledger)
	}
	if s.Phase != "EXTERNALIZE" {
		require.Fail(t, "phase: %q, expected EXTERNALIZE", s.Phase)
	}
	if len(s.Missing) != 1 {
		require.Fail(t, "missing len: %d, expected 1", len(s.Missing))
	}
}

const (
	lbRes = `{
   "node" : "lobstr3",
   "qset" : {
      "delayed" : null,
      "disagree" : null,
      "ledger" : 25889124,
      "missing" : null,
      "phase" : "expired",
      "validated" : true
   }
}
`
	kbRes = `{
   "node" : "keybase2",
   "qset" : {
      "agree" : 16,
      "delayed" : null,
      "disagree" : null,
      "fail_at" : 4,
      "fail_with" : [ "sdf3", "sdf1", "coinqvest.FI", "coinqvest.HK" ],
      "hash" : "b69f17",
      "ledger" : 25889136,
      "missing" : [ "lobstr3" ],
      "phase" : "EXTERNALIZE",
      "validated" : true,
      "value" : {
         "t" : 4,
         "v" : [
            {
               "t" : 2,
               "v" : [ "sdf3", "sdf1", "sdf2" ]
            },
            {
               "t" : 2,
               "v" : [ "coinqvest.FI", "coinqvest.HK", "coinqvest.DE" ]
            },
            {
               "t" : 2,
               "v" : [ "satoshipay.US", "satoshipay.SG", "satoshipay.DE" ]
            },
            {
               "t" : 2,
               "v" : [ "keybase3", "keybase1", "keybase2" ]
            },
            {
               "t" : 3,
               "v" : [ "lobstr5", "lobstr4", "lobstr1", "lobstr2", "lobstr3" ]
            }
         ]
      }
   }
}
`
)
