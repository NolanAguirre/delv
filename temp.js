const EventEmitter = require('events')

class Query extends EventEmitter{
    constructor(id, queryManager){
        super()
        this.id = id
        this.queryManager = queryManager
        this.on('newListener', this.addNewListener)
        this.on('removeListener', this.removeOldListener)
    }

    addNewListener(){
        if(this.listenerCount('data') === 0){
            this.queryManager.activate(this.id)
        }
    }

    removeOldListener(){
        if(this.listenerCount('data') === 0){
            this.queryManager.deactivate(this.id)
        }
    }
}

const query = new Query()
console.log(query.get())
