// @flow
/**
 * User Timing polyfill (http://www.w3.org/TR/user-timing/)
 * @author RubaXa <trash@rubaxa.org>
 */
;(function(global) {
  // var startOffset = Date.now ? Date.now() : +new Date()
  var startOffset = 0

  var performance = global.performance || {}

  var _entries = []

  var _marksIndex = {}

  var _filterEntries = function(key, value) {
    var i = 0
    var n = _entries.length
    var result = []
    for (; i < n; i++) {
      if (_entries[i][key] == value) {
        result.push(_entries[i])
      }
    }
    return result
  }

  var _clearEntries = function(type, name) {
    var i = _entries.length
    var entry
    while (i--) {
      entry = _entries[i]
      if (entry.entryType == type && (name === void 0 || entry.name == name)) {
        _entries.splice(i, 1)
      }
    }
  }

  if (!performance.now) {
    performance.now =
      performance.webkitNow ||
      performance.mozNow ||
      performance.msNow ||
      function() {
        return (Date.now ? Date.now() : +new Date()) - startOffset
      }
  }

  if (!performance.mark) {
    performance.mark =
      performance.webkitMark ||
      function(name) {
        var mark = {
          name: name,
          entryType: 'mark',
          startTime: performance.now(),
          duration: 0,
        }
        _entries.push(mark)
        _marksIndex[name] = mark
      }
  }

  if (!performance.measure) {
    performance.measure =
      performance.webkitMeasure ||
      function(name, startMark, endMark) {
        let endTime = _marksIndex[endMark] ? _marksIndex[endMark].startTime : performance.now()

        if (_marksIndex[startMark] && endTime) {
          startMark = _marksIndex[startMark].startTime

          _entries.push({
            name: name,
            entryType: 'measure',
            startTime: startMark,
            duration: endTime - startMark,
          })
        }
      }
  }

  if (!performance.getEntriesByType) {
    performance.getEntriesByType =
      performance.webkitGetEntriesByType ||
      function(type) {
        return _filterEntries('entryType', type)
      }
  }

  if (!performance.getEntries) {
    performance.getEntries = function() {
      return _entries
    }
  }

  if (!performance.getEntriesByName) {
    performance.getEntriesByName =
      performance.webkitGetEntriesByName ||
      function(name) {
        return _filterEntries('name', name)
      }
  }

  if (!performance.clearMarks) {
    performance.clearMarks =
      performance.webkitClearMarks ||
      function(name) {
        _clearEntries('mark', name)
      }
  }

  if (!performance.clearMeasures) {
    performance.clearMeasures =
      performance.webkitClearMeasures ||
      function(name) {
        _clearEntries('measure', name)
      }
  }

  // exports
  global.performance = performance

  if (typeof define === 'function' && (define.amd || define.ajs)) {
    define('performance', [], function() {
      return performance
    })
  }
})(global)
