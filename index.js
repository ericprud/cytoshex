const { DataFactory } = N3;
const { namedNode, literal, defaultGraph, quad } = DataFactory;
const dataElt = document.getElementById('data')
const schemaElt = document.getElementById('schema')
const buttonElt = document.getElementById('validate')
const renderElt = document.getElementById('cy')
const shexEditor = ace.edit('schema')
const base = 'http://cy.example/'
const defaultNS = base + '#'
const shexParser = ShExParser.construct(base, {}, {index: true})
let lastDataStr = null
let cy = null

function doit (evt) {
  const demoData = {
    nodes: [
      { data: { id: 'a' }, selected: true },
      { data: { id: 'a1' } },
      { data: { id: 'a2' } },
      { data: { id: 'a3' } },

      { data: { id: 'b' }, selected: true },
      { data: { id: 'b1' } },
      { data: { id: 'b2' } },
      { data: { id: 'b3' } },

      { data: { id: 'c' }, selected: true },
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
  dataElt.value =
    '{\n'
    + '  "nodes": [\n    ' + demoData.nodes.map(JSON.stringify).join(',\n    ') + '\n  ],\n'
    + '  "edges": [\n    ' + demoData.edges.map(JSON.stringify).join(',\n    ') + '\n  ]\n}'
  const demoSchema = `PREFIX : <#>
start=@<#foo>
<#foo> {
  :rel1 . ;
  :rel2 . + ;
  :rel3 . *
}`
  shexEditor.setTheme('ace/theme/dawn')
  shexEditor.session.setMode('ace/mode/shexc')
  shexEditor.setValue(demoSchema, 1)
  dataElt.onblur = renderData
}


function renderData () {
  try {
    const elements = JSON.parse(dataElt.value)

    // Don't do anything if the data hasn't changed.
    const str = JSON.stringify(elements)
    if (str === lastDataStr)
      return
    lastDataStr = str

    buttonElt.onclick = evt => renderValidation(elements)
    cy = cytoscape({
      elements: elements,
      container: renderElt,
      style: getStyle(),
      layout: { name: 'grid', padding: 10 },
      ready: function (){ window.cy = this; }
    });
  } catch (e) {
    renderElt.innerText = "Data error: " + e.stack
  }
}

function renderValidation (elements) {
  const {n3Store, shapeMap} = parseData(elements)
  console.log(shapeMap)
  try {
    const schema = shexParser.parse(shexEditor.getValue())
    const shexValidator = ShExCore.Validator.construct(schema)
    const db = ShExCore.Util.makeN3DB(n3Store)
    shapeMap.forEach(m => {
      const results = shexValidator.validate(db, m.node, m.shape)
      console.log(results)
      if ('errors' in results) {
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
      } else {
        elements.nodes.filter(
          n => defaultNS + n.data.id === results.node
        ).forEach(
          n => delete n.selected
        )
      }
    })
    cy = cytoscape({
      elements: elements,
      container: renderElt,
      style: getStyle(),
      layout: { name: 'grid', padding: 10 },
      ready: function (){ window.cy = this; }
    });
  } catch (e) {
    renderElt.innerText = "Schema error: " + e.stack
  }
}

function parseData (elements) {
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
  const shapeMap = cy.$(':selected').map(sel => sel.id()).map(
    n =>
      ({node: defaultNS + n, shape: ShExCore.Validator.start})
  )
  return {n3Store, shapeMap}
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
