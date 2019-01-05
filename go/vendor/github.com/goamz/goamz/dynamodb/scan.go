package dynamodb

import (
	"errors"
	"fmt"
	simplejson "github.com/bitly/go-simplejson"
)

func (t *Table) FetchResults(startKey *Key, query *Query) ([]map[string]*Attribute, *Key, error) {
	if startKey != nil {
		query.AddStartKey(t, startKey)
	}
	jsonResponse, err := t.Server.queryServer(target("Scan"), query)
	if err != nil {
		return nil, nil, err
	}
	json, err := simplejson.NewJson(jsonResponse)
	if err != nil {
		return nil, nil, err
	}

	itemCount, err := json.Get("Count").Int()
	if err != nil {
		message := fmt.Sprintf("Unexpected response %s", jsonResponse)
		return nil, nil, errors.New(message)
	}

	var lastKey *Key
	if marker, ok := json.CheckGet("LastEvaluatedKey"); ok {
		keymap, err := marker.Map()
		if err != nil {
			return nil, nil, fmt.Errorf("Unexpected LastEvaluatedKey in response %s\n", jsonResponse)
		}
		lastKey = &Key{}
		hashmap := keymap[t.Key.KeyAttribute.Name].(map[string]interface{})
		lastKey.HashKey = hashmap[t.Key.KeyAttribute.Type].(string)
		if t.Key.HasRange() {
			rangemap := keymap[t.Key.RangeAttribute.Name].(map[string]interface{})
			lastKey.RangeKey = rangemap[t.Key.RangeAttribute.Type].(string)
		}
	}

	results := make([]map[string]*Attribute, itemCount)
	for i, _ := range results {
		item, err := json.Get("Items").GetIndex(i).Map()
		if err != nil {
			message := fmt.Sprintf("Unexpected response %s", jsonResponse)
			return nil, lastKey, errors.New(message)
		}
		results[i] = parseAttributes(item)
	}
	return results, lastKey, nil

}

func (t *Table) Scan(attributeComparisons []AttributeComparison) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddScanFilter(attributeComparisons)
	attrs, _, err := t.FetchResults(nil, q)
	return attrs, err
}

func (t *Table) ScanWithPagination(startKey *Key, attributeComparisons []AttributeComparison) ([]map[string]*Attribute, *Key, error) {
	q := NewQuery(t)
	q.AddScanFilter(attributeComparisons)
	return t.FetchResults(startKey, q)
}

func (t *Table) ParallelScan(attributeComparisons []AttributeComparison, segment int, totalSegments int) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddScanFilter(attributeComparisons)
	q.AddParallelScanConfiguration(segment, totalSegments)
	attrs, _, err := t.FetchResults(nil, q)
	return attrs, err
}
