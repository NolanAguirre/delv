import graphql from 'graphql-anywhere'
import gql from 'graphql-tag'


const UID = 'id'



const read = ({query, storage, typeMap}) => {
    const resolver = (fieldName, root, args, context, info) => {
        if(fieldName === '__typename'){
            return
        }
        if(context.query){
            const type = typeMap.getTypeDefinition('Query')
            let childType = type[fieldName]
            context.query=false
            storage.get(childType)
            return storage.get(childType)
        }

        if(fieldName === 'edges' || fieldName === 'nodes'){
            if(root.getValues){
                return root.getValues()
            }
            return root
        }

        if(fieldName === 'node'){
            return root
        }

        if(info.isLeaf){
            return root[fieldName]
        }
        const rootType = root['__typename']
        const type = typeMap.getTypeDefinition(rootType)
        const childType = type[fieldName]
        if(root[fieldName] instanceof Array){
            const childChoices = storage.get(childType)
            let getById = root[fieldName].map((id)=>{
                return childChoices.get(id)
            })
            if(args){
                getById = getById.filter((item)=>{
                    //apply filters here
                    return true
                })
            }
            return getById
        }else{
            return storage.get(fieldName).get(root[childType])
        }
    }

    return graphql(resolver, gql `${query}`, storage, {storage, query:true})
}

const cacheUnknown = ({node, ...other}) => {
    if(node.nodes && node.edges){
        throw new Error('Nodes and edges detected on, choose one.')
    }
    if(node.nodes){
        return node.nodes.map((item)=>{
            return cacheNode({node:item, ...other})
        })
    }
    if(node.edges){
        return node.edges.map((item)=>{
            if(item.cursor){
                item.node['__cursor'] = item.cursor
            }
            return cacheNode({node:item.node, ...other})
        })
    }else{
        return cacheNode({node, ...other})
    }
}

const cacheNode = ({node, parent, emitter, storage, typeMap, ...other}) => {
    const type = node['__typename']
    const parentType = (parent)?parent['__typename']:'none'
    const typeDefinition = typeMap.getTypeDefinition(type)
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
            node[key] = cacheUnknown({node:value, parent:node, emitter, storage, typeMap, ...other})
        }
    }
    emitter.updateType(type)
    storage.merge(node[UID], type, node)
    return node[UID]
}


const write = ({data, emitter, ...other}) => {
    for(let key in data.data){
        if(key !== '__typename'){
            const value = data.data[key]
            cacheUnknown({node:value, emitter, ...other})
        }
    }
    emitter.emitCacheUpdate()
}
export default {
    name:'type',
    read,
    write
}
