import axios from 'axios'

class AxiosWithErrors {
    constructor({url}) {
        this.url = url
    }

    post = ({query, variables}) => {
        console.log('posting to network')
        query = query.replace(/{(\n)/g,'{\n__typename\n')
        return new Promise((resolve, reject) => {
            axios.post(this.url, {
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

export default AxiosWithErrors
