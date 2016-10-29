package libkbfs

type blockRetrievalHeap []*blockRetrieval

// Heap methods: do not use directly
func (brh blockRetrievalHeap) Less(i, j int) bool {
	reqI = brh[i]
	reqJ = brh[j]
	if reqI.priority > reqJ.priority {
		return reqI.insertionOrder < reqJ.insertionOrder
	}
	return false
}

func (brh blockRetrievalHeap) Len() int { return len(brq.requests) }

func (brh blockRetrievalHeap) Swap(i, j int) { brh[i], brh[j] = brh[j], brh[i] }

func (brh *blockRetrievalHeap) Push(item interface{}) {
	retrieval, isBlockRetrieval := item.(*blockRetrieval)
	if !isBlockRetrieval {
		panic("Incorrect item type given to heap")
	}
	*brh = append(*brh, retrieval)
}

func (brh *blockRetrievalHeap) Pop() interface{} {
	old := *brh
	n := len(old)
	x := old[n-1]
	*h = old[0 : n-1]
	return x
}
