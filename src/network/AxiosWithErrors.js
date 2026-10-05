const {parse, print, visit, Kind} = require('graphql')

const addTypenames = (query) => print(visit(parse(query), {
    SelectionSet(node, key, parent){
        // Normalize nested objects, leaving the operation's root fields alone.
        if(parent.kind === Kind.OPERATION_DEFINITION) return

        const alreadySelected = node.selections.some((selection) => (
            selection.kind === Kind.FIELD &&
            selection.name.value === '__typename' &&
            !selection.alias &&
            (!selection.directives || !selection.directives.length)
        ))
        if(alreadySelected) return

        return {
            ...node,
            selections: [...node.selections, {
                kind: Kind.FIELD,
                name: {kind: Kind.NAME, value: '__typename'}
            }]
        }
    }
}))

class AxiosWithErrors {
    constructor({url, httpClient}) {
        if(!httpClient || typeof httpClient.post !== 'function'){
            throw new Error('AxiosWithErrors requires an httpClient with a post(url, body) method, such as axios')
        }
        this.url = url
        this.httpClient = httpClient
    }

    post = ({query, variables}) => {
        console.log('posting to network')
        return new Promise((resolve, reject) => {
            query = addTypenames(query)
            this.httpClient.post(this.url, {
                query,
                variables
            }).then((res) => {
                if(res.data.errors){
                    reject(res.data.errors)
                }else{
                    resolve(res)
                }
            }).catch((error) => {
                reject(error)
            })
        })
    }
}

module.exports = AxiosWithErrors
