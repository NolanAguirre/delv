import Delv from './delv'
import WSEvents from './WSQueries'
import _ from 'lodash'

const allowedTypes = Object.keys(WSEvents)

class DelvWebSocket{
    constructor(url){
        this.url = url || `wss://${window.location.host}/wss/v1/`
        this.ready = false
        this.subscribedTo = {}
        this.queue = []
    }

    connect = () => {
        if(!this.ws){
            this.ws = new WebSocket(this.url)
            this.ws.onopen = this.onOpen
            this.ws.onmessage = this.onMessage
            this.ws.onclose = this.onClose
        }
    }

    disconnect = () => {
        if(this.ws){
            this.ws.close()
        }
    }

    subscribe = ({type, ids}) => {
        if(allowedTypes.includes(type)){
            if(this.ready){
                let newId = false
                if(this.subscribedTo[type]){
                    let currentIds = this.subscribedTo[type]
                    ids.forEach((id)=>{
                        if(!currentIds.includes(id)){
                            newId = true
                            currentIds.push(id)
                        }
                    })
                }else{
                    newId = true
                    this.subscribedTo[type] = ids
                }
                if(newId){
                    this.ws.send(JSON.stringify({
                        type:'subscribe',
                        table:type,
                        ids
                    }))
                }
            }else{
                this.queue.push({
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

    unsubscribe = ({type, ids}) => {
        if(this.ready){
            if(this.subscribedTo[type]){
                const newSubcribedTo = this.subscribedTo[type].filter((item)=>!ids.includes(item))
                if(newSubcribedTo.length !== this.subscribedTo.length){
                    this.subscribedTo = newSubcribedTo
                    this.ws.send(JSON.stringify({
                        type:'unsubscribe',
                        table:type,
                        ids
                    }))
                }
            }
        }else{
            this.queue.push({
                method:'unsubscribe',
                data:{
                    type,
                    ids
                }
            })
        }
    }

    onOpen = () => {
        console.log('connected')
        this.ready = true
        this.queue.forEach((item)=>{
            switch(item.method){
                case 'subscribe':
                    this.subscribe(item.data)
                    break
                case 'unsubscribe':
                    this.unsubscribe(item.data)
                    break
            }
        })
    }

    onMessage = (message) => {
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

    onClose = () => {
        this.ready = false
    }
}

export default new DelvWebSocket()
