import Delv from './delv'
import WSEvents from './WSQueries'
import _ from 'lodash'

const allowedTypes = Object.keys(WSEvents)

function DelvWebSocket(){
    let url = url
    let ready = false
    let subscribedTo = {}
    let queue = []

    const connect = () => {
        if(!ws){
            ws = new WebSocket(url)
            ws.onopen = onOpen
            ws.onmessage = onMessage
            ws.onclose = onClose
        }
    }

    const disconnect = () => {
        if(ws){
            ws.close()
        }
    }

    const subscribe = ({type, ids}) => {
        if(allowedTypes.includes(type)){
            if(ready){
                let newId = false
                if(subscribedTo[type]){
                    let currentIds = subscribedTo[type]
                    ids.forEach((id)=>{
                        if(!currentIds.includes(id)){
                            newId = true
                            currentIds.push(id)
                        }
                    })
                }else{
                    newId = true
                    subscribedTo[type] = ids
                }
                if(newId){
                    ws.send(JSON.stringify({
                        type:'subscribe',
                        table:type,
                        ids
                    }))
                }
            }else{
                queue.push({
                    method:'subscribe',
                    data:{
                        type,
                        ids
                    }
                })
            }
        }else{
            console.log('typed not supported')
        }
    }

    const unsubscribe = ({type, ids}) => {
        if(ready){
            if(subscribedTo[type]){
                const newSubcribedTo = subscribedTo[type].filter((item)=>!ids.includes(item))
                if(newSubcribedTo.length !== subscribedTo.length){
                    subscribedTo = newSubcribedTo
                    ws.send(JSON.stringify({
                        type:'unsubscribe',
                        table:type,
                        ids
                    }))
                }
            }
        }else{
            queue.push({
                method:'unsubscribe',
                data:{
                    type,
                    ids
                }
            })
        }
    }

    const onOpen = () => {
        console.log('connected')
        ready = true
        queue.forEach((item)=>{
            switch(item.method){
                case 'subscribe':
                    subscribe(item.data)
                    break
                case 'unsubscribe':
                    unsubscribe(item.data)
                    break
            }
        })
    }

    const onMessage = (message) => {
        const data = JSON.parse(message.data)
        const queryInfo = WSEvents[data.type]
        Delv.query({
            query: queryInfo.query(data.id),
            networkPolicy: 'network-only',
            cacheProcess:'default',
            onFetch: ()=>{},
            onResolve: (res)=>queryInfo.onResolve({data:res, type:data.type, ws:this}),
            onError: ()=>{}
        })
    }

    const onClose = () => {
        ready = false
    }

    return{
        subscribe,
        unsubscribe
    }
}

export default new DelvWebSocket()
