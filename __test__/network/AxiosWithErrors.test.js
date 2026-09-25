jest.mock('axios')

const axios = require('axios')
const {parse} = require('graphql')
const AxiosWithErrors = require('../../src/network/AxiosWithErrors')

const url = 'http://localhost/graphql'
const variables = {id: '1'}

describe('AxiosWithErrors', () => {
    beforeEach(() => {
        axios.post.mockReset()
    })

    it.each(['{ user { id } }', '{\n  user { id }\n}'])(
        'injects __typename into nested selections: %s', (query) => {
        const network = new AxiosWithErrors({url})
        axios.post.mockResolvedValue({data: {data: {user: {id: '1'}}}})

        return network.post({query, variables}).then(() => {
            expect(axios.post).toHaveBeenCalledTimes(1)
            const [calledUrl, body] = axios.post.mock.calls[0]
            expect(calledUrl).toBe(url)
            expect(parse(body.query, {noLocation: true})).toEqual(
                parse('{ user { id __typename } }', {noLocation: true}))
            expect(body.variables).toBe(variables)
        })
    })

    it.each([
        ['{ user { id __typename } }', '{ user { id __typename } }'],
        ['{ user { type: __typename } }', '{ user { type: __typename __typename } }'],
        ['query($skip: Boolean!) { user { __typename @skip(if: $skip) } }',
            'query($skip: Boolean!) { user { __typename @skip(if: $skip) __typename } }'],
        ['{ user { ...UserFields } } fragment UserFields on User { id }',
            '{ user { ...UserFields __typename } } fragment UserFields on User { id __typename }'],
        ['{ node { ... on User { id } } }', '{ node { ... on User { id __typename } __typename } }'],
        ['mutation { createUser { user { id } } }',
            'mutation { createUser { user { id __typename } __typename } }'],
        ['{ user(name: "A  B { text }") { id } }',
            '{ user(name: "A  B { text }") { id __typename } }']
    ])('preserves selections and ensures an unaliased typename: %s', async (query, expected) => {
        axios.post.mockResolvedValue({data: {data: {}}})
        const network = new AxiosWithErrors({url})
        await network.post({query, variables})
        const sent = axios.post.mock.calls[0][1].query
        expect(parse(sent, {noLocation: true})).toEqual(parse(expected, {noLocation: true}))
        // Reprocessing an already transformed document must not add duplicates.
        await network.post({query: sent, variables})
        expect(axios.post.mock.calls[1][1].query).toBe(sent)
    })

    it('rejects invalid GraphQL without sending a request', async () => {
        const network = new AxiosWithErrors({url})
        await expect(network.post({query: '{ user {', variables})).rejects.toThrow('Syntax Error')
        expect(axios.post).not.toHaveBeenCalled()
    })

    it('resolves with the response on success', () => {
        const network = new AxiosWithErrors({url})
        const res = {data: {data: {user: {id: '1'}}}}
        axios.post.mockResolvedValue(res)

        return expect(network.post({query: '{\nuser { id }\n}', variables})).resolves.toBe(res)
    })

    it('rejects with res.data.errors when present', () => {
        const network = new AxiosWithErrors({url})
        const errors = [{message: 'boom'}]
        axios.post.mockResolvedValue({data: {errors}})

        return expect(network.post({query: '{\nuser { id }\n}', variables})).rejects.toBe(errors)
    })

    it('rejects on a network error', () => {
        const network = new AxiosWithErrors({url})
        const error = new Error('network down')
        axios.post.mockRejectedValue(error)

        return expect(network.post({query: '{\nuser { id }\n}', variables})).rejects.toBe(error)
    })
})
