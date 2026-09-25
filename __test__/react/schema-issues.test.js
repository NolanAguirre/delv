import React from 'react'
import TestRenderer, {act} from 'react-test-renderer'
import {DelvProvider} from '../../src/react/delv-react'
const {TypeMap, createCache, Delv} = require('../../src')
jest.mock('axios')
const axios = require('axios')

const field = (name, type) => ({name, type: {kind: 'OBJECT', name: type}})
const createClient = async reverseReferences => {
    axios.post.mockResolvedValue({data: {data: {__schema: {types: [
        {name: 'User', fields: [field('manager', 'User')]}
    ]}}}})
    const map = await TypeMap({api: '/graphql'})
    return Delv({cache: createCache(TypeMap({typeMap: map})), network: {}, queryManager: {},
        networkPolicies: [], reverseReferences})
}

it('shows actionable diagnostics after network introspection and mounts children after configuration', async () => {
    const Child = jest.fn(() => <span>Application</span>)
    let view
    await act(async () => {
        view = TestRenderer.create(<DelvProvider client={createClient()}><Child /></DelvProvider>)
    })
    expect(Child).not.toHaveBeenCalled()
    const screen = JSON.stringify(view.toJSON())
    expect(screen).toContain('Delv needs relationship configuration')
    expect(view.root.findByType('strong').children.join('')).toBe('User.manager')
    expect(screen).toContain('reverseReferences')
    expect(view.root.findByType('pre').children.join('')).toContain('"manager": null')
    await act(async () => {
        view.update(<DelvProvider client={createClient({User: {manager: null}})}><Child /></DelvProvider>)
    })
    expect(view.root.findByType('span').children).toEqual(['Application'])
    view.unmount()
})
