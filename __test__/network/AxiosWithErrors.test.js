jest.mock('axios')

const axios = require('axios')
const AxiosWithErrors = require('../../src/network/AxiosWithErrors')

const url = 'http://localhost/graphql'
const variables = {id: '1'}

describe('AxiosWithErrors', () => {
    beforeEach(() => {
        axios.post.mockReset()
    })

    it('injects __typename into the selection and posts to the url', () => {
        const network = new AxiosWithErrors({url})
        axios.post.mockResolvedValue({data: {data: {user: {id: '1'}}}})

        return network.post({query: '{\n  user { id }\n}', variables}).then(() => {
            expect(axios.post).toHaveBeenCalledTimes(1)
            const [calledUrl, body] = axios.post.mock.calls[0]
            expect(calledUrl).toBe(url)
            expect(body.query).toBe('{\n__typename\n  user { id }\n}')
            expect(body.variables).toBe(variables)
        })
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
