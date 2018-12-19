module.exports = class queryMap extends Map{
    constructor(){
        super();
    }
    getKey = (value) => {
        for(var [k,v] of this.entries()){
            if(v === value){
                return k;
            }
        }
        return undefined;
    }
}
