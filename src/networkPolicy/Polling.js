class Polling {
    constructor({cache, network, queryManager}){
        this.cache = cache
        this.network = network
        this.queryManager = queryManager
    }
    getName = () => 'polling'

    // TODO: define lifecycle controls before enabling polling as a supported policy
    process = () => {
        throw new Error('Polling is not yet implemented')
    }
}

module.exports = Polling
