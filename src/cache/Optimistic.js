// Optimistic writes go straight into the store and are journaled. A failed
// mutation undoes them once; a successful one just forgets the journal and
// lets its response and later writes correct the cache.
const Optimistic = ({journal, emitter}) => {
    let pending = new Map()

    const revert = (undo) => {
        undo().forEach(emitter.updateType)
    }

    const apply = (id, fn, context) => emitter.batch(() => {
        let error
        const undo = journal.record(() => {
            try{
                fn(context)
            }catch(e){
                error = e
            }
        })
        if(error){
            revert(undo)
            console.error('delv: optimistic update failed and was rolled back.', error)
            return
        }
        pending.set(id, undo)
    })

    const rollback = (id) => emitter.batch(() => {
        const undo = pending.get(id)
        pending.delete(id)
        if(undo) revert(undo)
    })

    const discard = (id) => {
        pending.delete(id)
    }

    const clear = () => {
        pending = new Map()
    }

    return {
        apply,
        rollback,
        discard,
        clear
    }
}

module.exports = Optimistic
