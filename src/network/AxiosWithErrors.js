import axios from 'axios'

class AxiosWithErrors {
    constructor({url, config}) {
        this.url = url
        config(axios)
    }

    post = ({query, variable}) => {
        query = query.replace(/{(\n)/g,'{\n__typename\n')
        return new Promise((resolve, reject) => {
            axios.post(this.url, {
                query,
                variables
            }).then((data) => {
                if(data.errors){
                    reject(data.errors)
                }else{
                    resolve(data)
                }
            }).catch((error) => {
                reject(error)
            })
        })
    }
}

export default AxiosWithErrors
