import React from 'react'
import {createRoot} from 'react-dom/client'
import {DelvProvider} from 'delv/react'
import createClient from './delv.js'
import App from './App.jsx'

const root = createRoot(document.getElementById('root'))

const boot = async () => {
    try{
        const client = await createClient()
        root.render(
            <React.StrictMode>
                <DelvProvider client={client}>
                    <App />
                </DelvProvider>
            </React.StrictMode>
        )
    }catch(error){
        root.render(
            <pre style={{color: 'crimson', padding: 16}}>
                Failed to start delv client: {String(error && error.message ? error.message : error)}
            </pre>
        )
    }
}

boot()
