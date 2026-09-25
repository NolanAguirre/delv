import React from 'react'
import {act, create} from 'react-test-renderer'
import DelvDebugPanel from '../../src/debug/DebugPanel'
const createDebugSidecar = require('../../src/debug/Diagnostics')

test('panel opts in, filters events, inspects cache, pauses and cleans up subscriptions', () => {
    jest.useFakeTimers()
    const sidecar = createDebugSidecar()
    sidecar.connect({inspectCache: () => ({User: {'1': {id: '1'}}}), subscribe: () => () => {}})
    const unsubscribe = jest.fn()
    const originalSubscribe = sidecar.subscribe
    sidecar.subscribe = callback => {
        const release = originalSubscribe(callback)
        return () => { unsubscribe(); release() }
    }
    let panel
    act(() => { panel = create(<DelvDebugPanel sidecar={sidecar} />) })
    expect(panel.toJSON()).toBeNull()
    act(() => { panel.update(<DelvDebugPanel sidecar={sidecar} enabled defaultOpen />) })
    act(() => { panel.root.findByType('button').props.onClick() })
    const buttons = () => panel.root.findAllByType('button')
    const click = label => act(() => buttons().find(button => button.children.join('') === label).props.onClick())
    act(() => { sidecar.onCacheRead({query: '{user{id}}'}).success({id: '1'}); jest.runAllTimers() })
    expect(JSON.stringify(panel.toJSON())).toContain('cache.read.success')
    click('Pause view')
    act(() => { sidecar.onNetworkRequest({query: '{user{id}}'}); jest.runAllTimers() })
    expect(JSON.stringify(panel.toJSON())).not.toContain('network.request.start')
    click('Resume')
    expect(JSON.stringify(panel.toJSON())).toContain('network.request.start')
    act(() => panel.root.findByType('select').props.onChange({target: {value: 'cache.read'}}))
    expect(JSON.stringify(panel.toJSON())).not.toContain('network.request.start')
    click('Cache')
    expect(JSON.stringify(panel.toJSON())).toContain('User')
    click('Clear logs')
    expect(sidecar.getEvents()).toEqual([])
    act(() => panel.unmount())
    expect(unsubscribe).toHaveBeenCalled()
    jest.useRealTimers()
})
