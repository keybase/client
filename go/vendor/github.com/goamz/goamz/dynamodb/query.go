package dynamodb

import (
	"errors"
	"fmt"
	simplejson "github.com/bitly/go-simplejson"
)

const (
	returnConsumedCapacity     bool = true
	dontReturnConsumedCapacity bool = false
)

func (t *Table) Query(attributeComparisons []AttributeComparison) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	return runQuery(q, t)
}

func (t *Table) QueryWithPagination(startKey *Key, attributeComparisons []AttributeComparison) ([]map[string]*Attribute, *Key, error) {
	attrs, lastKey, _, err := t.queryWithPagination(startKey, attributeComparisons, dontReturnConsumedCapacity)
	return attrs, lastKey, err
}

func (t *Table) QueryWithPagination2(startKey *Key, attributeComparisons []AttributeComparison) ([]map[string]*Attribute, *Key, *simplejson.Json, error) {
	return t.queryWithPagination(startKey, attributeComparisons, returnConsumedCapacity)
}

func (t *Table) queryWithPagination(startKey *Key, attributeComparisons []AttributeComparison, shouldReturnConsumedCapacity bool) ([]map[string]*Attribute, *Key, *simplejson.Json, error) {
	q := NewQuery(t)
	if startKey != nil {
		q.AddStartKey(t, startKey)
	}
	q.ReturnConsumedCapacity(shouldReturnConsumedCapacity)
	q.AddKeyConditions(attributeComparisons)
	attrs, jsonResponse, err := runQuery2(q, t)
	if err != nil {
		return nil, nil, jsonResponse, err
	}

	var lastKey *Key
	if marker, ok := jsonResponse.CheckGet("LastEvaluatedKey"); ok {
		keymap, err := marker.Map()
		if err != nil {
			return nil, nil, jsonResponse, fmt.Errorf("Unexpected LastEvaluatedKey in response")
		}
		lastKey = &Key{}
		hashmap := keymap[t.Key.KeyAttribute.Name].(map[string]interface{})
		lastKey.HashKey = hashmap[t.Key.KeyAttribute.Type].(string)
		if t.Key.HasRange() {
			rangemap := keymap[t.Key.RangeAttribute.Name].(map[string]interface{})
			lastKey.RangeKey = rangemap[t.Key.RangeAttribute.Type].(string)
		}
	}
	return attrs, lastKey, jsonResponse, nil
}

func (t *Table) QueryConsistent(attributeComparisons []AttributeComparison, consistentRead bool) (
	[]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.ConsistentRead(consistentRead)
	q.AddKeyConditions(attributeComparisons)
	return runQuery(q, t)
}

func (t *Table) QueryOnIndex(attributeComparisons []AttributeComparison, indexName string) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	return runQuery(q, t)
}

func (t *Table) QueryOnIndexConsistent(attributeComparisons []AttributeComparison, indexName string, consistentRead bool) (
	[]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.ConsistentRead(consistentRead)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	return runQuery(q, t)
}

func (t *Table) QueryOnIndexDescending(attributeComparisons []AttributeComparison, indexName string) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	q.ScanIndexDescending()
	return runQuery(q, t)
}

func (t *Table) QueryOnIndexDescendingConsistent(attributeComparisons []AttributeComparison, indexName string, consistentRead bool) (
	[]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.ConsistentRead(consistentRead)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	q.ScanIndexDescending()
	return runQuery(q, t)
}

func (t *Table) LimitedQuery(attributeComparisons []AttributeComparison, limit int64) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddLimit(limit)
	return runQuery(q, t)
}

func (t *Table) LimitedQueryConsistent(attributeComparisons []AttributeComparison, limit int64, consistentRead bool) (
	[]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.ConsistentRead(consistentRead)
	q.AddKeyConditions(attributeComparisons)
	q.AddLimit(limit)
	return runQuery(q, t)
}

func (t *Table) LimitedQueryOnIndex(attributeComparisons []AttributeComparison, indexName string, limit int64) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	q.AddLimit(limit)
	return runQuery(q, t)
}

func (t *Table) LimitedQueryOnIndexConsistent(attributeComparisons []AttributeComparison, indexName string, limit int64, consistentRead bool) (
	[]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.ConsistentRead(consistentRead)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	q.AddLimit(limit)
	return runQuery(q, t)
}

func (t *Table) LimitedQueryDescending(attributeComparisons []AttributeComparison, limit int64) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddLimit(limit)
	q.ScanIndexDescending()
	return runQuery(q, t)
}

func (t *Table) LimitedQueryDescendingConsistent(attributeComparisons []AttributeComparison, limit int64, consistentRead bool) (
	[]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.ConsistentRead(consistentRead)
	q.AddKeyConditions(attributeComparisons)
	q.AddLimit(limit)
	q.ScanIndexDescending()
	return runQuery(q, t)
}

func (t *Table) LimitedQueryOnIndexDescending(attributeComparisons []AttributeComparison, indexName string, limit int64) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	q.AddLimit(limit)
	q.ScanIndexDescending()
	return runQuery(q, t)
}

func (t *Table) LimitedQueryOnIndexDescendingConsistent(attributeComparisons []AttributeComparison, indexName string, limit int64, consistentRead bool) (
	[]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.ConsistentRead(consistentRead)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	q.AddLimit(limit)
	q.ScanIndexDescending()
	return runQuery(q, t)
}

func (t *Table) CountQuery(attributeComparisons []AttributeComparison) (int64, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddSelect("COUNT")
	jsonResponse, err := t.Server.queryServer("DynamoDB_20120810.Query", q)
	if err != nil {
		return 0, err
	}
	json, err := simplejson.NewJson(jsonResponse)
	if err != nil {
		return 0, err
	}

	itemCount, err := json.Get("Count").Int64()
	if err != nil {
		return 0, err
	}

	return itemCount, nil
}

func runQuery(q *Query, t *Table) ([]map[string]*Attribute, error) {
	attrs, _, err := runQuery2(q, t)
	return attrs, err
}

func (t *Table) QueryConsistent2(attributeComparisons []AttributeComparison, consistentRead bool) (
	[]map[string]*Attribute, *simplejson.Json, error) {
	q := NewQuery(t)
	q.ConsistentRead(consistentRead)
	q.AddKeyConditions(attributeComparisons)
	q.ReturnConsumedCapacity(true)
	return runQuery2(q, t)
}

func (t *Table) QueryOnIndex2(attributeComparisons []AttributeComparison, indexName string) (
	[]map[string]*Attribute, *simplejson.Json, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	q.ReturnConsumedCapacity(true)
	return runQuery2(q, t)
}

func (t *Table) LimitedQueryConsistent2(attributeComparisons []AttributeComparison, limit int64, consistentRead bool) (
	[]map[string]*Attribute, *simplejson.Json, error) {
	q := NewQuery(t)
	q.ConsistentRead(consistentRead)
	q.AddKeyConditions(attributeComparisons)
	q.AddLimit(limit)
	q.ReturnConsumedCapacity(true)
	return runQuery2(q, t)
}

func (t *Table) LimitedQueryDescendingConsistent2(attributeComparisons []AttributeComparison, limit int64, consistentRead bool) (
	[]map[string]*Attribute, *simplejson.Json, error) {
	q := NewQuery(t)
	q.ConsistentRead(consistentRead)
	q.AddKeyConditions(attributeComparisons)
	q.AddLimit(limit)
	q.ScanIndexDescending()
	q.ReturnConsumedCapacity(true)
	return runQuery2(q, t)
}

func runQuery2(q *Query, t *Table) ([]map[string]*Attribute, *simplejson.Json, error) {
	jsonResponse, err := t.Server.queryServer("DynamoDB_20120810.Query", q)
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

	results := make([]map[string]*Attribute, itemCount)

	for i := range results {
		item, err := json.Get("Items").GetIndex(i).Map()
		if err != nil {
			message := fmt.Sprintf("Unexpected response %s", jsonResponse)
			return nil, nil, errors.New(message)
		}
		results[i] = parseAttributes(item)
	}
	return results, json, nil
}
