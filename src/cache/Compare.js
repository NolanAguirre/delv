const numericTypes = new Set(['Int', 'Float', 'BigInt', 'BigFloat', 'Decimal', 'Numeric'])

// PostGraphile represents arbitrary precision numerics as strings. Compare
// decimal digits directly rather than lexically or through a lossy Number cast.
const decimal = (value) => {
    const match = String(value).match(/^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/)
    if(!match || !(match[2] || match[3])) return null
    const digits = (match[2] + (match[3] || '')).replace(/^0+/, '') || '0'
    return {digits, sign: digits === '0' ? 0 : match[1] === '-' ? -1 : 1,
        magnitude: digits.length - (match[3] || '').length + Number(match[4] || 0)}
}
const compare = (a, b, type) => {
    if(a == null || b == null) return a == b ? 0 : a == null ? 1 : -1
    if(numericTypes.has(type)){
        const left = decimal(a)
        const right = decimal(b)
        if(left && right){
            if(left.sign !== right.sign) return left.sign < right.sign ? -1 : 1
            if(!left.sign) return 0
            if(left.magnitude !== right.magnitude) return (left.magnitude < right.magnitude ? -1 : 1) * left.sign
            const length = Math.max(left.digits.length, right.digits.length)
            const x = left.digits.padEnd(length, '0')
            const y = right.digits.padEnd(length, '0')
            return (x < y ? -1 : x > y ? 1 : 0) * left.sign
        }
    }
    return a < b ? -1 : a > b ? 1 : 0
}
module.exports = compare
