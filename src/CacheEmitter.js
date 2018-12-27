import EventEmitter from 'events'

class CacheEmitter extends EventEmitter{
    constructor(){
        super();
        this.changedTypes = [];
    }
    changeType = (type) => {
        if(!this.changedTypes.includes(type)){
            this.changedTypes.push(type);
        }
    }

    emitCacheUpdate = () => {
        Object.keys(this['_events']).forEach((name)=>{
            this.emit(name, this.changedTypes);
        })
        this.changedTypes = [];
    }

}
export default new CacheEmitter()
