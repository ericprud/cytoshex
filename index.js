const { DataFactory } = N3;
const { namedNode, literal, defaultGraph, quad } = DataFactory;
const bodyElt = document.getElementsByTagName('body')[0]
const dataElt = document.getElementById('data')
const validateButton = document.getElementById('validate')
const editButton = document.getElementById('edit')
const dataCyElt = document.getElementById('dataCy')
const shexEditor = ace.edit('schema')
const base = 'http://cy.example/'
const defaultNS = base + '#'
const shexParser = ShExParser.construct(base, {}, {index: true})

let lastDataStr = null // copy of most recent data
let dataCy = null // cytoscape display of data

window.onload = function (evt) {
  renderData(demoData)
  shexEditor.setTheme('ace/theme/dawn')
  shexEditor.session.setMode('ace/mode/shexc')
  shexEditor.setValue(demoSchema, 1)
  dataElt.onblur = parseData
}


function renderData (elements) {
  dataElt.value
    = '{\n'
    + '  "nodes": [\n    ' + elements.nodes.map(JSON.stringify).join(',\n    ') + '\n  ],\n'
    + '  "edges": [\n    ' + elements.edges.map(stringifyEdge).join(',\n    ') + '\n  ]\n'
    + '}'

  function stringifyEdge (e) {
    // get rid of the noisy edge.data.id 'cause i don't know how to use it anyways.
    copy = JSON.parse(JSON.stringify(e))
    delete copy.data.id
    return JSON.stringify(copy)
  }
}

function parseData () {
  try {
    const elements = JSON.parse(dataElt.value)

    // Don't do anything if the data hasn't changed.
    const str = JSON.stringify(elements)
    if (str === lastDataStr)
      return
    lastDataStr = str

    validateButton.onclick = evt => renderValidation(elements)
    editButton.onclick = evt => renderData(elements)
    bodyElt.onkeydown = function (e) {
      var code = e.keyCode || e.charCode; // standards anyone?
      if (e.ctrlKey && (code === 10 || code === 13)) {
        renderValidation(elements)
        return false
      }
      return true
    }
    updateGraph(elements)
  } catch (e) {
    lastDataStr = null
    dataCyElt.innerText = "Data error: " + e.stack
  }
}

function renderValidation (elements) {
  const {n3Store, shapeMap} = triplifyData(elements)
  try {
    const schema = shexParser.parse(shexEditor.getValue())
    const shexValidator = ShExCore.Validator.construct(schema)
    const db = ShExCore.Util.makeN3DB(n3Store)

    // uncolor everything before starting validation.
    elements.nodes.concat(elements.edges).forEach(
      n => delete n.selected
    )
    shapeMap.forEach(m => {
      const results = shexValidator.validate(db, m.node, m.shape)
      if ('errors' in results) {
        elements.nodes.filter(
          n => defaultNS + n.data.id === results.node
        ).forEach(n => n.selected = true)

        const arcsOut = elements.edges.filter(
          edge => defaultNS + edge.data.source === results.node
        )
        results.errors.forEach(err => {
          arcsOut.forEach(edge => {
            if (defaultNS + edge.data.label === err.property
               || 'constraint' in err && defaultNS + edge.data.label === err.constraint.predicate)
              edge.selected = true;
          })
        })
      }
    })
    updateGraph(elements)
  } catch (e) {
    dataCyElt.innerText = "Schema error: " + e.stack
  }
}

function triplifyData (elements) {
  const nodes = elements.nodes.reduce((acc, n) => {
    acc[n.data.id] = literal(n.data.name)
    return acc
  }, {})
  const arcs = elements.edges.map(e => quad(
    namedNode(defaultNS + e.data.source),
    namedNode(defaultNS + e.data.label),
    namedNode(defaultNS + e.data.target),
  ))
  const n3Store = new N3.Store()
  n3Store.addQuads(arcs)
  const shapeMap = dataCy.$(':selected').map(sel => sel.id()).map(
    n =>
      ({node: defaultNS + n, shape: ShExCore.Validator.start})
  )
  return {n3Store, shapeMap}
}

function updateGraph (elements) {
  dataCyElt.innerText = '' // clear out any old error messages
  dataCy = cytoscape({
    elements: elements,
    container: dataCyElt,
    style: getStyle(),
    layout: { name: 'grid', padding: 10 },
    ready: function (){ window.dataCy = this; }
  })
}

function getStyle () {
  return cytoscape.stylesheet()
    .selector('edge')
    .css({
      'content': 'data(label)'
    })
    .selector('edge:selected')
    .css({
      'overlay-color': 'red',
      'overlay-opacity': '0.2',
      'overlay-padding': function( node ){
        var bb = node.boundingBox();
        
        return Math.max( (bb.h - node.outerHeight())/2, (bb.w - node.outerWidth())/2 );
      }
    })
    .selector('node')
    .css({
      'content': 'data(id)'
    })
    .selector('node:selected')
    .css({
      'overlay-color': 'red',
      'overlay-opacity': '0.2',
      'overlay-padding': function( node ){
        var bb = node.boundingBox();
        
        return Math.max( bb.h - node.outerHeight(), (bb.w - node.outerWidth())/2 ); // /2 b/c centred text
      }
    })
}

const demoData = {
  nodes: [
    { data: { id: 'a' } },
    { data: { id: 'a1' } },
    { data: { id: 'a2' } },
    { data: { id: 'a3' } },

    { data: { id: 'b' }, selected: true },
    { data: { id: 'b1' } },
    { data: { id: 'b2' } },
    { data: { id: 'b3' } },

    { data: { id: 'c' } },
    { data: { id: 'c1' } },
    { data: { id: 'c2' } },
    { data: { id: 'c3' } },

    // { data: { id: 'd' }, selected: true },
    // { data: { id: 'd1' } },
    // { data: { id: 'd2' } },
    // { data: { id: 'd3' } },
  ],
  edges: [
    { data: { source: 'a', target: 'a1', label: 'rel1' } },
    { data: { source: 'a', target: 'a2', label: 'rel2' } },
    { data: { source: 'a', target: 'a3', label: 'rel3' } },

    { data: { source: 'b', target: 'b1', label: 'rel1' } },
    { data: { source: 'b', target: 'b2', label: 'rel1' } },
    { data: { source: 'b', target: 'b3', label: 'rel2' } },

    { data: { source: 'c', target: 'c1', label: 'rel1' } },
    { data: { source: 'c', target: 'c2', label: 'rel3' } },
    { data: { source: 'c', target: 'c3', label: 'rel3' } },

    // { data: { source: 'd', target: 'd1', label: 'rel1' } },
    // { data: { source: 'd', target: 'd2', label: 'rel2' } },
    // { data: { source: 'd', target: 'd3', label: 'rel3' } },
  ]
}

const demoSchema = `PREFIX : <#>
start=@<#foo>
<#foo> {
  :rel1 . ;
  :rel2 . + ;
  :rel3 . *
}`
