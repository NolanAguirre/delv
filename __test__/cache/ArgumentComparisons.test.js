const {applyWhere, applyOrderBy} = require('../../src/cache/Filter')
const compare = require('../../src/cache/Compare')
const access = {getType: () => 'BigFloat'}

it('sorts PostGraphile decimal strings numerically without losing precision', () => {
    const nodes = [
        {id: 'a', position: '1024'}, {id: 'b', position: '512'},
        {id: 'c', position: '512.00000000000000000001'}
    ]
    expect(applyOrderBy(nodes, ['POSITION_ASC', 'ID_ASC'], access).map((node) => node.id)).toEqual(['b', 'c', 'a'])
    expect(applyWhere(nodes, {position: {greaterThan: '512', lessThan: '1024'}}, access)).toEqual([nodes[2]])
})

it.each([
    ['-0.1', '-0.01', -1], ['1e3', '1000.0', 0], ['0', '-0.000', 0],
    ['0.0001', '0.001', -1], ['9007199254740993', '9007199254740992', 1]
])('compares %s and %s exactly', (a, b, expected) => {
    expect(compare(a, b, 'BigFloat')).toBe(expected)
})
