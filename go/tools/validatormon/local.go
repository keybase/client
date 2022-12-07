package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type LocalReader struct{}

type quorumRes struct {
	Node string
	Qset struct {
		Ledger  int
		Phase   string
		Missing []string
	}
}

func (r *LocalReader) StatusRead(accountID string) (*Status, error) {
	url := fmt.Sprintf("http://localhost:11626/quorum?node=%s", accountID)

	res, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	body, err := io.ReadAll(res.Body)
	res.Body.Close()
	if err != nil {
		return nil, err
	}

	return statusFromJSON(body)
}

func statusFromJSON(data []byte) (*Status, error) {
	var q quorumRes
	if err := json.Unmarshal(data, &q); err != nil {
		return nil, err
	}

	return &Status{
		Node:    q.Node,
		Ledger:  q.Qset.Ledger,
		Phase:   q.Qset.Phase,
		Missing: q.Qset.Missing,
	}, nil
}
