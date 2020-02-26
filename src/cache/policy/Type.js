const graphql = require('graphql-anywhere')
const gql = require('graphql-tag')

const UID = 'id'

function CacheByType({emitter, storage, typeMap}){

    const getName = () => 'type'

    const read = ({query}) => {
        const resolver = (fieldName, root, args, context, info) => {
            if(fieldName === '__typename'){
                return
            }

            if(context.query){
                const type = typeMap.getTypeDefinition('Query')
                let childType = type[fieldName]
                context.query = false
                if(args){
                    context.args = args
                }
                return storage.get(childType)
            }

            if(fieldName === 'edges' || fieldName === 'nodes'){
                let value = root

                if(root.getValues){
                    value = root.getValues()
                }
                if(context.args){
                    value = value.filter((item)=>{
                        return true
                    })
                    context.args = null
                }
                return value
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
                        console.log(item)
                        return true
                    })
                }
                return getById
            }else{
                return storage.get(fieldName).get(root[childType])
            }
        }

        return graphql(resolver, gql `${query}`, storage, {storage:storage, query:true})
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

    const cacheNode = ({node, parent, ...other}) => {
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
               node[key] = cacheUnknown({node:value, parent:node, ...other})
           }
       }
       emitter.updateType(type)
       storage.merge(node[UID], type, node)
       return node[UID]
   }

    const write = ({data, ...other}) => {
        for(let key in data.data){
            if(key !== '__typename'){
                const value = data.data[key]
                cacheUnknown({node:value, ...other})
            }
        }
        emitter.emitCacheUpdate()
    }

    return {
        read,
        write,
        getName
    }
}

module.exports = CacheByType
