let UID = 'id'

class Cache {
    constructor({storage, typeMap, emitter}) {
        this.storage = storage
        this.typeMap = typeMap
        this.emitter = emitter
    }

    cacheByQuery = (id, query) => {
        this.storage.setAbsolute(id, query)
    }

    loadByQuery = (id) => {
        this.storage.getAbsolute(id)
    }

    cacheByType = (query) => {
        for(let key in query){
            const value = query[key]
            if(value instanceof Object){
                this.cacheUnknown(value)
            }
        }
        this.emitter.emitCacheUpdate()
    }

    cacheUnknown = (node, parent) => {
        if(node.nodes){
            return node.nodes.map((item)=>{
                return this.cacheNode(item, parent)
            })
        }else if(node.edges){
            return node.edges.map((item)=>{
                if(item.cursor){
                    item.node['__cursor'] = item.cursor
                }
                return this.cacheNode(item.node, parent)
            })
        }else{
            return this.cacheNode(node, parent)
        }
    }

    cacheNode = (node, parent) => {
        const type = node['__typename']
        const parentType = (parent)?parent['__typename']:'none'
        const typeDefinition = this.typeMap.getTypeDefinition(type)
        for(let key in typeDefinition){
            let fieldType = typeDefinition[key]
            let value = node[key]
            if(fieldType === parentType){
                if(value){
                    console.log('A circular query has been detected.')
                }else{
                    node[key] = parent[UID]
                    continue
                }
            }
            if(value){
                node[key] = this.cacheUnknown(value, node)
            }
        }
        this.emitter.updateType(type)
        this.storage.merge(node[UID], type, node)
        return node[UID]
    }

    toString = () => {
        let printValue = {
            typeMap:this.typeMap.toString(),
            storage:this.storage.toString()
        }
        return printValue
    }
}

export default Cache
