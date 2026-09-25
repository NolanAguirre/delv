import {defineConfig, transformWithEsbuild} from 'vite'
import react from '@vitejs/plugin-react'

// delv ships CommonJS (src/index.js with module.exports) plus a React helper
// (src/react/delv-react.js) that contains JSX in a plain .js file. Because delv
// is linked via file:../../.. it resolves outside node_modules, so neither
// Vite's JSX handling nor its CommonJS interop kick in automatically:
//   - delvJsx runs the React helper through esbuild's jsx loader.
//   - build.commonjsOptions.include lets @rollup/plugin-commonjs process the
//     CJS entry so its named/default exports resolve.
//   - optimizeDeps pre-bundles delv for `vite dev`.
const delvJsx = () => ({
    name: 'delv-jsx',
    enforce: 'pre',
    transform: (code, id) => {
        if(id.includes('/src/react/delv-react.js')){
            return transformWithEsbuild(code, id, {loader: 'jsx'})
        }
        return null
    }
})

const HOST = process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.PORT) || 6001

// Dev-only: vite proxies /graphql to the API when not going through nginx.
export default defineConfig({
    plugins: [delvJsx(), react()],
    server: {
        host: HOST,
        port: PORT,
        proxy: {
            '/graphql': 'http://127.0.0.1:6000',
            '/graphiql': 'http://127.0.0.1:6000'
        }
    },
    optimizeDeps: {
        include: ['delv', 'delv/react'],
        esbuildOptions: {
            loader: {'.js': 'jsx'}
        }
    },
    build: {
        commonjsOptions: {
            include: [/delv/, /node_modules/],
            transformMixedEsModules: true
        }
    }
})
