package main

import (
	"errors"
	"testing"
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
		t.Errorf("CompareLedger: %d, expected 10000", n)
	}
}

func TestAnalyzeNode(t *testing.T) {
	a, err := AnalyzeNode(new(mockSR), "keybase1")
	if err != nil {
		t.Fatal(err)
	}
	if !a.Ok {
		t.Errorf("keybase1 not ok, expected ok: %+v", a)
	}

	a, err = AnalyzeNode(new(mockSR), "keybase2")
	if err != nil {
		t.Fatal(err)
	}
	if a.Ok {
		t.Errorf("keybase2 ok, expected not ok: %+v", a)
	}

	a, err = AnalyzeNode(new(mockSR), "keybase3")
	if err != nil {
		t.Fatal(err)
	}
	if a.Ok {
		t.Errorf("keybase3 ok, expected not ok: %+v", a)
	}
}
