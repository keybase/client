var bundle = /******/ (function(modules) {
  // webpackBootstrap
  /******/ // The module cache
  /******/ var installedModules = {} // The require function
  /******/
  /******/ /******/ function __webpack_require__(moduleId) {
    /******/
    /******/ // Check if module is in cache
    /******/ if (installedModules[moduleId]) {
      /******/ return installedModules[moduleId].exports
      /******/
    } // Create a new module (and put it into the cache)
    /******/ /******/ var module = (installedModules[moduleId] = {
      /******/ i: moduleId,
      /******/ l: false,
      /******/ exports: {},
      /******/
    }) // Execute the module function
    /******/
    /******/ /******/ modules[moduleId].call(module.exports, module, module.exports, __webpack_require__) // Flag the module as loaded
    /******/
    /******/ /******/ module.l = true // Return the exports of the module
    /******/
    /******/ /******/ return module.exports
    /******/
  } // expose the modules object (__webpack_modules__)
  /******/
  /******/
  /******/ /******/ __webpack_require__.m = modules // expose the module cache
  /******/
  /******/ /******/ __webpack_require__.c = installedModules // identity function for calling harmony imports with the correct context
  /******/
  /******/ /******/ __webpack_require__.i = function(value) {
    return value
  } // define getter function for harmony exports
  /******/
  /******/ /******/ __webpack_require__.d = function(exports, name, getter) {
    /******/ if (!__webpack_require__.o(exports, name)) {
      /******/ Object.defineProperty(exports, name, {
        /******/ configurable: false,
        /******/ enumerable: true,
        /******/ get: getter,
        /******/
      })
      /******/
    }
    /******/
  } // getDefaultExport function for compatibility with non-harmony modules
  /******/
  /******/ /******/ __webpack_require__.n = function(module) {
    /******/ var getter =
      module && module.__esModule
        ? /******/ function getDefault() {
            return module['default']
          }
        : /******/ function getModuleExports() {
            return module
          }
    /******/ __webpack_require__.d(getter, 'a', getter)
    /******/ return getter
    /******/
  } // Object.prototype.hasOwnProperty.call
  /******/
  /******/ /******/ __webpack_require__.o = function(object, property) {
    return Object.prototype.hasOwnProperty.call(object, property)
  } // __webpack_public_path__
  /******/
  /******/ /******/ __webpack_require__.p = '' // Load entry module and return exports
  /******/
  /******/ /******/ return __webpack_require__((__webpack_require__.s = 2))
  /******/
})(
  /************************************************************************/
  /******/ [
    /* 0 */
    /***/ function(module, exports, __webpack_require__) {
      var hyperx = __webpack_require__(5)
      var appendChild = __webpack_require__(3)

      var SVGNS = 'http://www.w3.org/2000/svg'
      var XLINKNS = 'http://www.w3.org/1999/xlink'

      var BOOL_PROPS = [
        'autofocus',
        'checked',
        'defaultchecked',
        'disabled',
        'formnovalidate',
        'indeterminate',
        'readonly',
        'required',
        'selected',
        'willvalidate',
      ]

      var COMMENT_TAG = '!--'

      var SVG_TAGS = [
        'svg',
        'altGlyph',
        'altGlyphDef',
        'altGlyphItem',
        'animate',
        'animateColor',
        'animateMotion',
        'animateTransform',
        'circle',
        'clipPath',
        'color-profile',
        'cursor',
        'defs',
        'desc',
        'ellipse',
        'feBlend',
        'feColorMatrix',
        'feComponentTransfer',
        'feComposite',
        'feConvolveMatrix',
        'feDiffuseLighting',
        'feDisplacementMap',
        'feDistantLight',
        'feFlood',
        'feFuncA',
        'feFuncB',
        'feFuncG',
        'feFuncR',
        'feGaussianBlur',
        'feImage',
        'feMerge',
        'feMergeNode',
        'feMorphology',
        'feOffset',
        'fePointLight',
        'feSpecularLighting',
        'feSpotLight',
        'feTile',
        'feTurbulence',
        'filter',
        'font',
        'font-face',
        'font-face-format',
        'font-face-name',
        'font-face-src',
        'font-face-uri',
        'foreignObject',
        'g',
        'glyph',
        'glyphRef',
        'hkern',
        'image',
        'line',
        'linearGradient',
        'marker',
        'mask',
        'metadata',
        'missing-glyph',
        'mpath',
        'path',
        'pattern',
        'polygon',
        'polyline',
        'radialGradient',
        'rect',
        'set',
        'stop',
        'switch',
        'symbol',
        'text',
        'textPath',
        'title',
        'tref',
        'tspan',
        'use',
        'view',
        'vkern',
      ]

      function belCreateElement(tag, props, children) {
        var el

        // If an svg tag, it needs a namespace
        if (SVG_TAGS.indexOf(tag) !== -1) {
          props.namespace = SVGNS
        }

        // If we are using a namespace
        var ns = false
        if (props.namespace) {
          ns = props.namespace
          delete props.namespace
        }

        // Create the element
        if (ns) {
          el = document.createElementNS(ns, tag)
        } else if (tag === COMMENT_TAG) {
          return document.createComment(props.comment)
        } else {
          el = document.createElement(tag)
        }

        // Create the properties
        for (var p in props) {
          if (props.hasOwnProperty(p)) {
            var key = p.toLowerCase()
            var val = props[p]
            // Normalize className
            if (key === 'classname') {
              key = 'class'
              p = 'class'
            }
            // The for attribute gets transformed to htmlFor, but we just set as for
            if (p === 'htmlFor') {
              p = 'for'
            }
            // If a property is boolean, set itself to the key
            if (BOOL_PROPS.indexOf(key) !== -1) {
              if (val === 'true') val = key
              else if (val === 'false') continue
            }
            // If a property prefers being set directly vs setAttribute
            if (key.slice(0, 2) === 'on') {
              el[p] = val
            } else {
              if (ns) {
                if (p === 'xlink:href') {
                  el.setAttributeNS(XLINKNS, p, val)
                } else if (/^xmlns($|:)/i.test(p)) {
                  // skip xmlns definitions
                } else {
                  el.setAttributeNS(null, p, val)
                }
              } else {
                el.setAttribute(p, val)
              }
            }
          }
        }

        appendChild(el, children)
        return el
      }

      module.exports = hyperx(belCreateElement, {comments: true})
      module.exports.default = module.exports
      module.exports.createElement = belCreateElement

      /***/
    },
    /* 1 */
    /***/ function(module, exports, __webpack_require__) {
      'use strict'

      var range // Create a range object for efficently rendering strings to elements.
      var NS_XHTML = 'http://www.w3.org/1999/xhtml'

      var doc = typeof document === 'undefined' ? undefined : document

      var testEl = doc ? doc.body || doc.createElement('div') : {}

      // Fixes <https://github.com/patrick-steele-idem/morphdom/issues/32>
      // (IE7+ support) <=IE7 does not support el.hasAttribute(name)
      var actualHasAttributeNS

      if (testEl.hasAttributeNS) {
        actualHasAttributeNS = function(el, namespaceURI, name) {
          return el.hasAttributeNS(namespaceURI, name)
        }
      } else if (testEl.hasAttribute) {
        actualHasAttributeNS = function(el, namespaceURI, name) {
          return el.hasAttribute(name)
        }
      } else {
        actualHasAttributeNS = function(el, namespaceURI, name) {
          return el.getAttributeNode(namespaceURI, name) != null
        }
      }

      var hasAttributeNS = actualHasAttributeNS

      function toElement(str) {
        if (!range && doc.createRange) {
          range = doc.createRange()
          range.selectNode(doc.body)
        }

        var fragment
        if (range && range.createContextualFragment) {
          fragment = range.createContextualFragment(str)
        } else {
          fragment = doc.createElement('body')
          fragment.innerHTML = str
        }
        return fragment.childNodes[0]
      }

      /**
       * Returns true if two node's names are the same.
       *
       * NOTE: We don't bother checking `namespaceURI` because you will never find two HTML elements with the same
       *       nodeName and different namespace URIs.
       *
       * @param {Element} a
       * @param {Element} b The target element
       * @return {boolean}
       */
      function compareNodeNames(fromEl, toEl) {
        var fromNodeName = fromEl.nodeName
        var toNodeName = toEl.nodeName

        if (fromNodeName === toNodeName) {
          return true
        }

        if (
          toEl.actualize &&
          fromNodeName.charCodeAt(0) < 91 /* from tag name is upper case */ &&
          toNodeName.charCodeAt(0) > 90 /* target tag name is lower case */
        ) {
          // If the target element is a virtual DOM node then we may need to normalize the tag name
          // before comparing. Normal HTML elements that are in the "http://www.w3.org/1999/xhtml"
          // are converted to upper case
          return fromNodeName === toNodeName.toUpperCase()
        } else {
          return false
        }
      }

      /**
       * Create an element, optionally with a known namespace URI.
       *
       * @param {string} name the element name, e.g. 'div' or 'svg'
       * @param {string} [namespaceURI] the element's namespace URI, i.e. the value of
       * its `xmlns` attribute or its inferred namespace.
       *
       * @return {Element}
       */
      function createElementNS(name, namespaceURI) {
        return !namespaceURI || namespaceURI === NS_XHTML
          ? doc.createElement(name)
          : doc.createElementNS(namespaceURI, name)
      }

      /**
       * Copies the children of one DOM element to another DOM element
       */
      function moveChildren(fromEl, toEl) {
        var curChild = fromEl.firstChild
        while (curChild) {
          var nextChild = curChild.nextSibling
          toEl.appendChild(curChild)
          curChild = nextChild
        }
        return toEl
      }

      function morphAttrs(fromNode, toNode) {
        var attrs = toNode.attributes
        var i
        var attr
        var attrName
        var attrNamespaceURI
        var attrValue
        var fromValue

        for (i = attrs.length - 1; i >= 0; --i) {
          attr = attrs[i]
          attrName = attr.name
          attrNamespaceURI = attr.namespaceURI
          attrValue = attr.value

          if (attrNamespaceURI) {
            attrName = attr.localName || attrName
            fromValue = fromNode.getAttributeNS(attrNamespaceURI, attrName)

            if (fromValue !== attrValue) {
              fromNode.setAttributeNS(attrNamespaceURI, attrName, attrValue)
            }
          } else {
            fromValue = fromNode.getAttribute(attrName)

            if (fromValue !== attrValue) {
              fromNode.setAttribute(attrName, attrValue)
            }
          }
        }

        // Remove any extra attributes found on the original DOM element that
        // weren't found on the target element.
        attrs = fromNode.attributes

        for (i = attrs.length - 1; i >= 0; --i) {
          attr = attrs[i]
          if (attr.specified !== false) {
            attrName = attr.name
            attrNamespaceURI = attr.namespaceURI

            if (attrNamespaceURI) {
              attrName = attr.localName || attrName

              if (!hasAttributeNS(toNode, attrNamespaceURI, attrName)) {
                fromNode.removeAttributeNS(attrNamespaceURI, attrName)
              }
            } else {
              if (!hasAttributeNS(toNode, null, attrName)) {
                fromNode.removeAttribute(attrName)
              }
            }
          }
        }
      }

      function syncBooleanAttrProp(fromEl, toEl, name) {
        if (fromEl[name] !== toEl[name]) {
          fromEl[name] = toEl[name]
          if (fromEl[name]) {
            fromEl.setAttribute(name, '')
          } else {
            fromEl.removeAttribute(name, '')
          }
        }
      }

      var specialElHandlers = {
        /**
         * Needed for IE. Apparently IE doesn't think that "selected" is an
         * attribute when reading over the attributes using selectEl.attributes
         */
        OPTION: function(fromEl, toEl) {
          syncBooleanAttrProp(fromEl, toEl, 'selected')
        },
        /**
         * The "value" attribute is special for the <input> element since it sets
         * the initial value. Changing the "value" attribute without changing the
         * "value" property will have no effect since it is only used to the set the
         * initial value.  Similar for the "checked" attribute, and "disabled".
         */
        INPUT: function(fromEl, toEl) {
          syncBooleanAttrProp(fromEl, toEl, 'checked')
          syncBooleanAttrProp(fromEl, toEl, 'disabled')

          if (fromEl.value !== toEl.value) {
            fromEl.value = toEl.value
          }

          if (!hasAttributeNS(toEl, null, 'value')) {
            fromEl.removeAttribute('value')
          }
        },

        TEXTAREA: function(fromEl, toEl) {
          var newValue = toEl.value
          if (fromEl.value !== newValue) {
            fromEl.value = newValue
          }

          var firstChild = fromEl.firstChild
          if (firstChild) {
            // Needed for IE. Apparently IE sets the placeholder as the
            // node value and vise versa. This ignores an empty update.
            var oldValue = firstChild.nodeValue

            if (oldValue == newValue || (!newValue && oldValue == fromEl.placeholder)) {
              return
            }

            firstChild.nodeValue = newValue
          }
        },
        SELECT: function(fromEl, toEl) {
          if (!hasAttributeNS(toEl, null, 'multiple')) {
            var selectedIndex = -1
            var i = 0
            var curChild = toEl.firstChild
            while (curChild) {
              var nodeName = curChild.nodeName
              if (nodeName && nodeName.toUpperCase() === 'OPTION') {
                if (hasAttributeNS(curChild, null, 'selected')) {
                  selectedIndex = i
                  break
                }
                i++
              }
              curChild = curChild.nextSibling
            }

            fromEl.selectedIndex = i
          }
        },
      }

      var ELEMENT_NODE = 1
      var TEXT_NODE = 3
      var COMMENT_NODE = 8

      function noop() {}

      function defaultGetNodeKey(node) {
        return node.id
      }

      function morphdomFactory(morphAttrs) {
        return function morphdom(fromNode, toNode, options) {
          if (!options) {
            options = {}
          }

          if (typeof toNode === 'string') {
            if (fromNode.nodeName === '#document' || fromNode.nodeName === 'HTML') {
              var toNodeHtml = toNode
              toNode = doc.createElement('html')
              toNode.innerHTML = toNodeHtml
            } else {
              toNode = toElement(toNode)
            }
          }

          var getNodeKey = options.getNodeKey || defaultGetNodeKey
          var onBeforeNodeAdded = options.onBeforeNodeAdded || noop
          var onNodeAdded = options.onNodeAdded || noop
          var onBeforeElUpdated = options.onBeforeElUpdated || noop
          var onElUpdated = options.onElUpdated || noop
          var onBeforeNodeDiscarded = options.onBeforeNodeDiscarded || noop
          var onNodeDiscarded = options.onNodeDiscarded || noop
          var onBeforeElChildrenUpdated = options.onBeforeElChildrenUpdated || noop
          var childrenOnly = options.childrenOnly === true

          // This object is used as a lookup to quickly find all keyed elements in the original DOM tree.
          var fromNodesLookup = {}
          var keyedRemovalList

          function addKeyedRemoval(key) {
            if (keyedRemovalList) {
              keyedRemovalList.push(key)
            } else {
              keyedRemovalList = [key]
            }
          }

          function walkDiscardedChildNodes(node, skipKeyedNodes) {
            if (node.nodeType === ELEMENT_NODE) {
              var curChild = node.firstChild
              while (curChild) {
                var key = undefined

                if (skipKeyedNodes && (key = getNodeKey(curChild))) {
                  // If we are skipping keyed nodes then we add the key
                  // to a list so that it can be handled at the very end.
                  addKeyedRemoval(key)
                } else {
                  // Only report the node as discarded if it is not keyed. We do this because
                  // at the end we loop through all keyed elements that were unmatched
                  // and then discard them in one final pass.
                  onNodeDiscarded(curChild)
                  if (curChild.firstChild) {
                    walkDiscardedChildNodes(curChild, skipKeyedNodes)
                  }
                }

                curChild = curChild.nextSibling
              }
            }
          }

          /**
           * Removes a DOM node out of the original DOM
           *
           * @param  {Node} node The node to remove
           * @param  {Node} parentNode The nodes parent
           * @param  {Boolean} skipKeyedNodes If true then elements with keys will be skipped and not discarded.
           * @return {undefined}
           */
          function removeNode(node, parentNode, skipKeyedNodes) {
            if (onBeforeNodeDiscarded(node) === false) {
              return
            }

            if (parentNode) {
              parentNode.removeChild(node)
            }

            onNodeDiscarded(node)
            walkDiscardedChildNodes(node, skipKeyedNodes)
          }

          // // TreeWalker implementation is no faster, but keeping this around in case this changes in the future
          // function indexTree(root) {
          //     var treeWalker = document.createTreeWalker(
          //         root,
          //         NodeFilter.SHOW_ELEMENT);
          //
          //     var el;
          //     while((el = treeWalker.nextNode())) {
          //         var key = getNodeKey(el);
          //         if (key) {
          //             fromNodesLookup[key] = el;
          //         }
          //     }
          // }

          // // NodeIterator implementation is no faster, but keeping this around in case this changes in the future
          //
          // function indexTree(node) {
          //     var nodeIterator = document.createNodeIterator(node, NodeFilter.SHOW_ELEMENT);
          //     var el;
          //     while((el = nodeIterator.nextNode())) {
          //         var key = getNodeKey(el);
          //         if (key) {
          //             fromNodesLookup[key] = el;
          //         }
          //     }
          // }

          function indexTree(node) {
            if (node.nodeType === ELEMENT_NODE) {
              var curChild = node.firstChild
              while (curChild) {
                var key = getNodeKey(curChild)
                if (key) {
                  fromNodesLookup[key] = curChild
                }

                // Walk recursively
                indexTree(curChild)

                curChild = curChild.nextSibling
              }
            }
          }

          indexTree(fromNode)

          function handleNodeAdded(el) {
            onNodeAdded(el)

            var curChild = el.firstChild
            while (curChild) {
              var nextSibling = curChild.nextSibling

              var key = getNodeKey(curChild)
              if (key) {
                var unmatchedFromEl = fromNodesLookup[key]
                if (unmatchedFromEl && compareNodeNames(curChild, unmatchedFromEl)) {
                  curChild.parentNode.replaceChild(unmatchedFromEl, curChild)
                  morphEl(unmatchedFromEl, curChild)
                }
              }

              handleNodeAdded(curChild)
              curChild = nextSibling
            }
          }

          function morphEl(fromEl, toEl, childrenOnly) {
            var toElKey = getNodeKey(toEl)
            var curFromNodeKey

            if (toElKey) {
              // If an element with an ID is being morphed then it is will be in the final
              // DOM so clear it out of the saved elements collection
              delete fromNodesLookup[toElKey]
            }

            if (toNode.isSameNode && toNode.isSameNode(fromNode)) {
              return
            }

            if (!childrenOnly) {
              if (onBeforeElUpdated(fromEl, toEl) === false) {
                return
              }

              morphAttrs(fromEl, toEl)
              onElUpdated(fromEl)

              if (onBeforeElChildrenUpdated(fromEl, toEl) === false) {
                return
              }
            }

            if (fromEl.nodeName !== 'TEXTAREA') {
              var curToNodeChild = toEl.firstChild
              var curFromNodeChild = fromEl.firstChild
              var curToNodeKey

              var fromNextSibling
              var toNextSibling
              var matchingFromEl

              outer: while (curToNodeChild) {
                toNextSibling = curToNodeChild.nextSibling
                curToNodeKey = getNodeKey(curToNodeChild)

                while (curFromNodeChild) {
                  fromNextSibling = curFromNodeChild.nextSibling

                  if (curToNodeChild.isSameNode && curToNodeChild.isSameNode(curFromNodeChild)) {
                    curToNodeChild = toNextSibling
                    curFromNodeChild = fromNextSibling
                    continue outer
                  }

                  curFromNodeKey = getNodeKey(curFromNodeChild)

                  var curFromNodeType = curFromNodeChild.nodeType

                  var isCompatible = undefined

                  if (curFromNodeType === curToNodeChild.nodeType) {
                    if (curFromNodeType === ELEMENT_NODE) {
                      // Both nodes being compared are Element nodes

                      if (curToNodeKey) {
                        // The target node has a key so we want to match it up with the correct element
                        // in the original DOM tree
                        if (curToNodeKey !== curFromNodeKey) {
                          // The current element in the original DOM tree does not have a matching key so
                          // let's check our lookup to see if there is a matching element in the original
                          // DOM tree
                          if ((matchingFromEl = fromNodesLookup[curToNodeKey])) {
                            if (curFromNodeChild.nextSibling === matchingFromEl) {
                              // Special case for single element removals. To avoid removing the original
                              // DOM node out of the tree (since that can break CSS transitions, etc.),
                              // we will instead discard the current node and wait until the next
                              // iteration to properly match up the keyed target element with its matching
                              // element in the original tree
                              isCompatible = false
                            } else {
                              // We found a matching keyed element somewhere in the original DOM tree.
                              // Let's moving the original DOM node into the current position and morph
                              // it.

                              // NOTE: We use insertBefore instead of replaceChild because we want to go through
                              // the `removeNode()` function for the node that is being discarded so that
                              // all lifecycle hooks are correctly invoked
                              fromEl.insertBefore(matchingFromEl, curFromNodeChild)

                              fromNextSibling = curFromNodeChild.nextSibling

                              if (curFromNodeKey) {
                                // Since the node is keyed it might be matched up later so we defer
                                // the actual removal to later
                                addKeyedRemoval(curFromNodeKey)
                              } else {
                                // NOTE: we skip nested keyed nodes from being removed since there is
                                //       still a chance they will be matched up later
                                removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */)
                              }

                              curFromNodeChild = matchingFromEl
                            }
                          } else {
                            // The nodes are not compatible since the "to" node has a key and there
                            // is no matching keyed node in the source tree
                            isCompatible = false
                          }
                        }
                      } else if (curFromNodeKey) {
                        // The original has a key
                        isCompatible = false
                      }

                      isCompatible =
                        isCompatible !== false && compareNodeNames(curFromNodeChild, curToNodeChild)
                      if (isCompatible) {
                        // We found compatible DOM elements so transform
                        // the current "from" node to match the current
                        // target DOM node.
                        morphEl(curFromNodeChild, curToNodeChild)
                      }
                    } else if (curFromNodeType === TEXT_NODE || curFromNodeType == COMMENT_NODE) {
                      // Both nodes being compared are Text or Comment nodes
                      isCompatible = true
                      // Simply update nodeValue on the original node to
                      // change the text value
                      if (curFromNodeChild.nodeValue !== curToNodeChild.nodeValue) {
                        curFromNodeChild.nodeValue = curToNodeChild.nodeValue
                      }
                    }
                  }

                  if (isCompatible) {
                    // Advance both the "to" child and the "from" child since we found a match
                    curToNodeChild = toNextSibling
                    curFromNodeChild = fromNextSibling
                    continue outer
                  }

                  // No compatible match so remove the old node from the DOM and continue trying to find a
                  // match in the original DOM. However, we only do this if the from node is not keyed
                  // since it is possible that a keyed node might match up with a node somewhere else in the
                  // target tree and we don't want to discard it just yet since it still might find a
                  // home in the final DOM tree. After everything is done we will remove any keyed nodes
                  // that didn't find a home
                  if (curFromNodeKey) {
                    // Since the node is keyed it might be matched up later so we defer
                    // the actual removal to later
                    addKeyedRemoval(curFromNodeKey)
                  } else {
                    // NOTE: we skip nested keyed nodes from being removed since there is
                    //       still a chance they will be matched up later
                    removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */)
                  }

                  curFromNodeChild = fromNextSibling
                }

                // If we got this far then we did not find a candidate match for
                // our "to node" and we exhausted all of the children "from"
                // nodes. Therefore, we will just append the current "to" node
                // to the end
                if (
                  curToNodeKey &&
                  (matchingFromEl = fromNodesLookup[curToNodeKey]) &&
                  compareNodeNames(matchingFromEl, curToNodeChild)
                ) {
                  fromEl.appendChild(matchingFromEl)
                  morphEl(matchingFromEl, curToNodeChild)
                } else {
                  var onBeforeNodeAddedResult = onBeforeNodeAdded(curToNodeChild)
                  if (onBeforeNodeAddedResult !== false) {
                    if (onBeforeNodeAddedResult) {
                      curToNodeChild = onBeforeNodeAddedResult
                    }

                    if (curToNodeChild.actualize) {
                      curToNodeChild = curToNodeChild.actualize(fromEl.ownerDocument || doc)
                    }
                    fromEl.appendChild(curToNodeChild)
                    handleNodeAdded(curToNodeChild)
                  }
                }

                curToNodeChild = toNextSibling
                curFromNodeChild = fromNextSibling
              }

              // We have processed all of the "to nodes". If curFromNodeChild is
              // non-null then we still have some from nodes left over that need
              // to be removed
              while (curFromNodeChild) {
                fromNextSibling = curFromNodeChild.nextSibling
                if ((curFromNodeKey = getNodeKey(curFromNodeChild))) {
                  // Since the node is keyed it might be matched up later so we defer
                  // the actual removal to later
                  addKeyedRemoval(curFromNodeKey)
                } else {
                  // NOTE: we skip nested keyed nodes from being removed since there is
                  //       still a chance they will be matched up later
                  removeNode(curFromNodeChild, fromEl, true /* skip keyed nodes */)
                }
                curFromNodeChild = fromNextSibling
              }
            }

            var specialElHandler = specialElHandlers[fromEl.nodeName]
            if (specialElHandler) {
              specialElHandler(fromEl, toEl)
            }
          } // END: morphEl(...)

          var morphedNode = fromNode
          var morphedNodeType = morphedNode.nodeType
          var toNodeType = toNode.nodeType

          if (!childrenOnly) {
            // Handle the case where we are given two DOM nodes that are not
            // compatible (e.g. <div> --> <span> or <div> --> TEXT)
            if (morphedNodeType === ELEMENT_NODE) {
              if (toNodeType === ELEMENT_NODE) {
                if (!compareNodeNames(fromNode, toNode)) {
                  onNodeDiscarded(fromNode)
                  morphedNode = moveChildren(fromNode, createElementNS(toNode.nodeName, toNode.namespaceURI))
                }
              } else {
                // Going from an element node to a text node
                morphedNode = toNode
              }
            } else if (morphedNodeType === TEXT_NODE || morphedNodeType === COMMENT_NODE) {
              // Text or comment node
              if (toNodeType === morphedNodeType) {
                if (morphedNode.nodeValue !== toNode.nodeValue) {
                  morphedNode.nodeValue = toNode.nodeValue
                }

                return morphedNode
              } else {
                // Text node to something else
                morphedNode = toNode
              }
            }
          }

          if (morphedNode === toNode) {
            // The "to node" was not compatible with the "from node" so we had to
            // toss out the "from node" and use the "to node"
            onNodeDiscarded(fromNode)
          } else {
            morphEl(morphedNode, toNode, childrenOnly)

            // We now need to loop over any keyed nodes that might need to be
            // removed. We only do the removal if we know that the keyed node
            // never found a match. When a keyed node is matched up we remove
            // it out of fromNodesLookup and we use fromNodesLookup to determine
            // if a keyed node has been matched up or not
            if (keyedRemovalList) {
              for (var i = 0, len = keyedRemovalList.length; i < len; i++) {
                var elToRemove = fromNodesLookup[keyedRemovalList[i]]
                if (elToRemove) {
                  removeNode(elToRemove, elToRemove.parentNode, false)
                }
              }
            }
          }

          if (!childrenOnly && morphedNode !== fromNode && fromNode.parentNode) {
            if (morphedNode.actualize) {
              morphedNode = morphedNode.actualize(fromNode.ownerDocument || doc)
            }
            // If we had to swap out the from node with a new node because the old
            // node was not compatible with the target node then we need to
            // replace the old DOM node in the original DOM tree. This is only
            // possible if the original DOM node was part of a DOM tree which
            // we know is the case if it has a parent node.
            fromNode.parentNode.replaceChild(morphedNode, fromNode)
          }

          return morphedNode
        }
      }

      var morphdom = morphdomFactory(morphAttrs)

      module.exports = morphdom

      /***/
    },
    /* 2 */
    /***/ function(module, exports, __webpack_require__) {
      module.exports = {
        bel: __webpack_require__(0),
        morphdom: __webpack_require__(1),
      }

      /***/
    },
    /* 3 */
    /***/ function(module, exports) {
      var trailingNewlineRegex = /\n[\s]+$/
      var leadingNewlineRegex = /^\n[\s]+/
      var trailingSpaceRegex = /[\s]+$/
      var leadingSpaceRegex = /^[\s]+/
      var multiSpaceRegex = /[\n\s]+/g

      var TEXT_TAGS = [
        'a',
        'abbr',
        'b',
        'bdi',
        'bdo',
        'br',
        'cite',
        'data',
        'dfn',
        'em',
        'i',
        'kbd',
        'mark',
        'q',
        'rp',
        'rt',
        'rtc',
        'ruby',
        's',
        'amp',
        'small',
        'span',
        'strong',
        'sub',
        'sup',
        'time',
        'u',
        'var',
        'wbr',
      ]

      var CODE_TAGS = ['code', 'pre']

      module.exports = function appendChild(el, childs) {
        if (!Array.isArray(childs)) return

        var nodeName = el.nodeName.toLowerCase()

        var hadText = false
        var value, leader

        for (var i = 0, len = childs.length; i < len; i++) {
          var node = childs[i]
          if (Array.isArray(node)) {
            appendChild(el, node)
            continue
          }

          if (
            typeof node === 'number' ||
            typeof node === 'boolean' ||
            typeof node === 'function' ||
            node instanceof Date ||
            node instanceof RegExp
          ) {
            node = node.toString()
          }

          var lastChild = el.childNodes[el.childNodes.length - 1]

          // Iterate over text nodes
          if (typeof node === 'string') {
            hadText = true

            // If we already had text, append to the existing text
            if (lastChild && lastChild.nodeName === '#text') {
              lastChild.nodeValue += node

              // We didn't have a text node yet, create one
            } else {
              node = document.createTextNode(node)
              el.appendChild(node)
              lastChild = node
            }

            // If this is the last of the child nodes, make sure we close it out
            // right
            if (i === len - 1) {
              hadText = false
              // Trim the child text nodes if the current node isn't a
              // node where whitespace matters.
              if (TEXT_TAGS.indexOf(nodeName) === -1 && CODE_TAGS.indexOf(nodeName) === -1) {
                value = lastChild.nodeValue
                  .replace(leadingNewlineRegex, '')
                  .replace(trailingSpaceRegex, '')
                  .replace(trailingNewlineRegex, '')
                  .replace(multiSpaceRegex, ' ')
                if (value === '') {
                  el.removeChild(lastChild)
                } else {
                  lastChild.nodeValue = value
                }
              } else if (CODE_TAGS.indexOf(nodeName) === -1) {
                // The very first node in the list should not have leading
                // whitespace. Sibling text nodes should have whitespace if there
                // was any.
                leader = i === 0 ? '' : ' '
                value = lastChild.nodeValue
                  .replace(leadingNewlineRegex, leader)
                  .replace(leadingSpaceRegex, ' ')
                  .replace(trailingSpaceRegex, '')
                  .replace(trailingNewlineRegex, '')
                  .replace(multiSpaceRegex, ' ')
                lastChild.nodeValue = value
              }
            }

            // Iterate over DOM nodes
          } else if (node && node.nodeType) {
            // If the last node was a text node, make sure it is properly closed out
            if (hadText) {
              hadText = false

              // Trim the child text nodes if the current node isn't a
              // text node or a code node
              if (TEXT_TAGS.indexOf(nodeName) === -1 && CODE_TAGS.indexOf(nodeName) === -1) {
                value = lastChild.nodeValue
                  .replace(leadingNewlineRegex, '')
                  .replace(trailingNewlineRegex, '')
                  .replace(multiSpaceRegex, ' ')

                // Remove empty text nodes, append otherwise
                if (value === '') {
                  el.removeChild(lastChild)
                } else {
                  lastChild.nodeValue = value
                }
                // Trim the child nodes if the current node is not a node
                // where all whitespace must be preserved
              } else if (CODE_TAGS.indexOf(nodeName) === -1) {
                value = lastChild.nodeValue
                  .replace(leadingSpaceRegex, ' ')
                  .replace(leadingNewlineRegex, '')
                  .replace(trailingNewlineRegex, '')
                  .replace(multiSpaceRegex, ' ')
                lastChild.nodeValue = value
              }
            }

            // Store the last nodename
            var _nodeName = node.nodeName
            if (_nodeName) nodeName = _nodeName.toLowerCase()

            // Append the node to the DOM
            el.appendChild(node)
          }
        }
      }

      /***/
    },
    /* 4 */
    /***/ function(module, exports) {
      module.exports = attributeToProperty

      var transform = {
        class: 'className',
        for: 'htmlFor',
        'http-equiv': 'httpEquiv',
      }

      function attributeToProperty(h) {
        return function(tagName, attrs, children) {
          for (var attr in attrs) {
            if (attr in transform) {
              attrs[transform[attr]] = attrs[attr]
              delete attrs[attr]
            }
          }
          return h(tagName, attrs, children)
        }
      }

      /***/
    },
    /* 5 */
    /***/ function(module, exports, __webpack_require__) {
      var attrToProp = __webpack_require__(4)

      var VAR = 0,
        TEXT = 1,
        OPEN = 2,
        CLOSE = 3,
        ATTR = 4
      var ATTR_KEY = 5,
        ATTR_KEY_W = 6
      var ATTR_VALUE_W = 7,
        ATTR_VALUE = 8
      var ATTR_VALUE_SQ = 9,
        ATTR_VALUE_DQ = 10
      var ATTR_EQ = 11,
        ATTR_BREAK = 12
      var COMMENT = 13

      module.exports = function(h, opts) {
        if (!opts) opts = {}
        var concat =
          opts.concat ||
          function(a, b) {
            return String(a) + String(b)
          }
        if (opts.attrToProp !== false) {
          h = attrToProp(h)
        }

        return function(strings) {
          var state = TEXT,
            reg = ''
          var arglen = arguments.length
          var parts = []

          for (var i = 0; i < strings.length; i++) {
            if (i < arglen - 1) {
              var arg = arguments[i + 1]
              var p = parse(strings[i])
              var xstate = state
              if (xstate === ATTR_VALUE_DQ) xstate = ATTR_VALUE
              if (xstate === ATTR_VALUE_SQ) xstate = ATTR_VALUE
              if (xstate === ATTR_VALUE_W) xstate = ATTR_VALUE
              if (xstate === ATTR) xstate = ATTR_KEY
              p.push([VAR, xstate, arg])
              parts.push.apply(parts, p)
            } else parts.push.apply(parts, parse(strings[i]))
          }

          var tree = [null, {}, []]
          var stack = [[tree, -1]]
          for (var i = 0; i < parts.length; i++) {
            var cur = stack[stack.length - 1][0]
            var p = parts[i],
              s = p[0]
            if (s === OPEN && /^\//.test(p[1])) {
              var ix = stack[stack.length - 1][1]
              if (stack.length > 1) {
                stack.pop()
                stack[stack.length - 1][0][2][ix] = h(cur[0], cur[1], cur[2].length ? cur[2] : undefined)
              }
            } else if (s === OPEN) {
              var c = [p[1], {}, []]
              cur[2].push(c)
              stack.push([c, cur[2].length - 1])
            } else if (s === ATTR_KEY || (s === VAR && p[1] === ATTR_KEY)) {
              var key = ''
              var copyKey
              for (; i < parts.length; i++) {
                if (parts[i][0] === ATTR_KEY) {
                  key = concat(key, parts[i][1])
                } else if (parts[i][0] === VAR && parts[i][1] === ATTR_KEY) {
                  if (typeof parts[i][2] === 'object' && !key) {
                    for (copyKey in parts[i][2]) {
                      if (parts[i][2].hasOwnProperty(copyKey) && !cur[1][copyKey]) {
                        cur[1][copyKey] = parts[i][2][copyKey]
                      }
                    }
                  } else {
                    key = concat(key, parts[i][2])
                  }
                } else break
              }
              if (parts[i][0] === ATTR_EQ) i++
              var j = i
              for (; i < parts.length; i++) {
                if (parts[i][0] === ATTR_VALUE || parts[i][0] === ATTR_KEY) {
                  if (!cur[1][key]) cur[1][key] = strfn(parts[i][1])
                  else parts[i][1] === '' || (cur[1][key] = concat(cur[1][key], parts[i][1]))
                } else if (parts[i][0] === VAR && (parts[i][1] === ATTR_VALUE || parts[i][1] === ATTR_KEY)) {
                  if (!cur[1][key]) cur[1][key] = strfn(parts[i][2])
                  else parts[i][2] === '' || (cur[1][key] = concat(cur[1][key], parts[i][2]))
                } else {
                  if (
                    key.length &&
                    !cur[1][key] &&
                    i === j &&
                    (parts[i][0] === CLOSE || parts[i][0] === ATTR_BREAK)
                  ) {
                    // https://html.spec.whatwg.org/multipage/infrastructure.html#boolean-attributes
                    // empty string is falsy, not well behaved value in browser
                    cur[1][key] = key.toLowerCase()
                  }
                  if (parts[i][0] === CLOSE) {
                    i--
                  }
                  break
                }
              }
            } else if (s === ATTR_KEY) {
              cur[1][p[1]] = true
            } else if (s === VAR && p[1] === ATTR_KEY) {
              cur[1][p[2]] = true
            } else if (s === CLOSE) {
              if (selfClosing(cur[0]) && stack.length) {
                var ix = stack[stack.length - 1][1]
                stack.pop()
                stack[stack.length - 1][0][2][ix] = h(cur[0], cur[1], cur[2].length ? cur[2] : undefined)
              }
            } else if (s === VAR && p[1] === TEXT) {
              if (p[2] === undefined || p[2] === null) p[2] = ''
              else if (!p[2]) p[2] = concat('', p[2])
              if (Array.isArray(p[2][0])) {
                cur[2].push.apply(cur[2], p[2])
              } else {
                cur[2].push(p[2])
              }
            } else if (s === TEXT) {
              cur[2].push(p[1])
            } else if (s === ATTR_EQ || s === ATTR_BREAK) {
              // no-op
            } else {
              throw new Error('unhandled: ' + s)
            }
          }

          if (tree[2].length > 1 && /^\s*$/.test(tree[2][0])) {
            tree[2].shift()
          }

          if (tree[2].length > 2 || (tree[2].length === 2 && /\S/.test(tree[2][1]))) {
            throw new Error('multiple root elements must be wrapped in an enclosing tag')
          }
          if (
            Array.isArray(tree[2][0]) &&
            typeof tree[2][0][0] === 'string' &&
            Array.isArray(tree[2][0][2])
          ) {
            tree[2][0] = h(tree[2][0][0], tree[2][0][1], tree[2][0][2])
          }
          return tree[2][0]

          function parse(str) {
            var res = []
            if (state === ATTR_VALUE_W) state = ATTR
            for (var i = 0; i < str.length; i++) {
              var c = str.charAt(i)
              if (state === TEXT && c === '<') {
                if (reg.length) res.push([TEXT, reg])
                reg = ''
                state = OPEN
              } else if (c === '>' && !quot(state) && state !== COMMENT) {
                if (state === OPEN) {
                  res.push([OPEN, reg])
                } else if (state === ATTR_KEY) {
                  res.push([ATTR_KEY, reg])
                } else if (state === ATTR_VALUE && reg.length) {
                  res.push([ATTR_VALUE, reg])
                }
                res.push([CLOSE])
                reg = ''
                state = TEXT
              } else if (state === COMMENT && /-$/.test(reg) && c === '-') {
                if (opts.comments) {
                  res.push([ATTR_VALUE, reg.substr(0, reg.length - 1)], [CLOSE])
                }
                reg = ''
                state = TEXT
              } else if (state === OPEN && /^!--$/.test(reg)) {
                if (opts.comments) {
                  res.push([OPEN, reg], [ATTR_KEY, 'comment'], [ATTR_EQ])
                }
                reg = c
                state = COMMENT
              } else if (state === TEXT || state === COMMENT) {
                reg += c
              } else if (state === OPEN && /\s/.test(c)) {
                res.push([OPEN, reg])
                reg = ''
                state = ATTR
              } else if (state === OPEN) {
                reg += c
              } else if (state === ATTR && /[^\s"'=/]/.test(c)) {
                state = ATTR_KEY
                reg = c
              } else if (state === ATTR && /\s/.test(c)) {
                if (reg.length) res.push([ATTR_KEY, reg])
                res.push([ATTR_BREAK])
              } else if (state === ATTR_KEY && /\s/.test(c)) {
                res.push([ATTR_KEY, reg])
                reg = ''
                state = ATTR_KEY_W
              } else if (state === ATTR_KEY && c === '=') {
                res.push([ATTR_KEY, reg], [ATTR_EQ])
                reg = ''
                state = ATTR_VALUE_W
              } else if (state === ATTR_KEY) {
                reg += c
              } else if ((state === ATTR_KEY_W || state === ATTR) && c === '=') {
                res.push([ATTR_EQ])
                state = ATTR_VALUE_W
              } else if ((state === ATTR_KEY_W || state === ATTR) && !/\s/.test(c)) {
                res.push([ATTR_BREAK])
                if (/[\w-]/.test(c)) {
                  reg += c
                  state = ATTR_KEY
                } else state = ATTR
              } else if (state === ATTR_VALUE_W && c === '"') {
                state = ATTR_VALUE_DQ
              } else if (state === ATTR_VALUE_W && c === "'") {
                state = ATTR_VALUE_SQ
              } else if (state === ATTR_VALUE_DQ && c === '"') {
                res.push([ATTR_VALUE, reg], [ATTR_BREAK])
                reg = ''
                state = ATTR
              } else if (state === ATTR_VALUE_SQ && c === "'") {
                res.push([ATTR_VALUE, reg], [ATTR_BREAK])
                reg = ''
                state = ATTR
              } else if (state === ATTR_VALUE_W && !/\s/.test(c)) {
                state = ATTR_VALUE
                i--
              } else if (state === ATTR_VALUE && /\s/.test(c)) {
                res.push([ATTR_VALUE, reg], [ATTR_BREAK])
                reg = ''
                state = ATTR
              } else if (state === ATTR_VALUE || state === ATTR_VALUE_SQ || state === ATTR_VALUE_DQ) {
                reg += c
              }
            }
            if (state === TEXT && reg.length) {
              res.push([TEXT, reg])
              reg = ''
            } else if (state === ATTR_VALUE && reg.length) {
              res.push([ATTR_VALUE, reg])
              reg = ''
            } else if (state === ATTR_VALUE_DQ && reg.length) {
              res.push([ATTR_VALUE, reg])
              reg = ''
            } else if (state === ATTR_VALUE_SQ && reg.length) {
              res.push([ATTR_VALUE, reg])
              reg = ''
            } else if (state === ATTR_KEY) {
              res.push([ATTR_KEY, reg])
              reg = ''
            }
            return res
          }
        }

        function strfn(x) {
          if (typeof x === 'function') return x
          else if (typeof x === 'string') return x
          else if (x && typeof x === 'object') return x
          else return concat('', x)
        }
      }

      function quot(state) {
        return state === ATTR_VALUE_SQ || state === ATTR_VALUE_DQ
      }

      var hasOwn = Object.prototype.hasOwnProperty
      function has(obj, key) {
        return hasOwn.call(obj, key)
      }

      var closeRE = RegExp(
        '^(' +
          [
            'area',
            'base',
            'basefont',
            'bgsound',
            'br',
            'col',
            'command',
            'embed',
            'frame',
            'hr',
            'img',
            'input',
            'isindex',
            'keygen',
            'link',
            'meta',
            'param',
            'source',
            'track',
            'wbr',
            '!--',
            // SVG TAGS
            'animate',
            'animateTransform',
            'circle',
            'cursor',
            'desc',
            'ellipse',
            'feBlend',
            'feColorMatrix',
            'feComposite',
            'feConvolveMatrix',
            'feDiffuseLighting',
            'feDisplacementMap',
            'feDistantLight',
            'feFlood',
            'feFuncA',
            'feFuncB',
            'feFuncG',
            'feFuncR',
            'feGaussianBlur',
            'feImage',
            'feMergeNode',
            'feMorphology',
            'feOffset',
            'fePointLight',
            'feSpecularLighting',
            'feSpotLight',
            'feTile',
            'feTurbulence',
            'font-face-format',
            'font-face-name',
            'font-face-uri',
            'glyph',
            'glyphRef',
            'hkern',
            'image',
            'line',
            'missing-glyph',
            'mpath',
            'path',
            'polygon',
            'polyline',
            'rect',
            'set',
            'stop',
            'tref',
            'use',
            'view',
            'vkern',
          ].join('|') +
          ')(?:[.#][a-zA-Z0-9\u007F-\uFFFF_:-]+)*$'
      )
      function selfClosing(tag) {
        return closeRE.test(tag)
      }

      /***/
    },
    /******/
  ]
)
