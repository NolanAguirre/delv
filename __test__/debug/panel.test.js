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

test('drag icon moves the open panel and is absent while collapsed', () => {
    const sidecar = createDebugSidecar()
    sidecar.connect({inspectCache: () => ({}), subscribe: () => () => {}})
    const rect = {left: 100, top: 200, width: 600, height: 460, getBoundingClientRect() { return rect }}
    let panel
    act(() => { panel = create(<DelvDebugPanel sidecar={sidecar} enabled defaultOpen />) })
    const icon = panel.root.findByProps({'aria-label': 'Drag debug panel'})
    expect(panel.root.findByType('header').props.onPointerDown).toBeUndefined()
    act(() => icon.props.onPointerDown({button: 0, clientX: 120, clientY: 220, target: {}, currentTarget: rect}))
    act(() => { window.dispatchEvent(new MouseEvent('pointermove', {clientX: 180, clientY: 260})) })
    act(() => { window.dispatchEvent(new MouseEvent('pointerup')) })
    const section = panel.root.findByType('section')
    expect(section.props.style.left).toBe(160)
    expect(section.props.style.top).toBe(240)
    act(() => panel.root.findAllByType('button').find(button => button.children.join('') === 'Collapse').props.onClick())
    expect(panel.root.findAllByProps({'aria-label': 'Drag debug panel'})).toHaveLength(0)
    expect(panel.root.findByType('button').props.onPointerDown).toBeUndefined()
    act(() => panel.unmount())
})
