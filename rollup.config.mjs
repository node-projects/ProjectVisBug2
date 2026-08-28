import {nodeResolve as resolve} from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import postcss  from 'rollup-plugin-postcss'
import terser from '@rollup/plugin-terser'

const is_prod = process.env.build === 'prod'

const dev_plugins = [
  resolve({
    browser: true,
  }),
  commonjs(),
  postcss({
    extract: false,
    inject:  false,
  }),
]

const prod_plugins = [
  terser(),
]

const plugins = is_prod
  ? [...dev_plugins, ...prod_plugins]
  : dev_plugins

export default {
  input: 'app/index.js',
  output: {
    dir:        'app',
    entryFileNames: is_prod ? 'bundle.min.js' : 'bundle.js',
    chunkFileNames: 'chunks/[name].js',
    manualChunks(id) {
      const moduleId = id.replaceAll('\\', '/')
      if (moduleId.includes('@node-projects/acad-ts')) return 'layout2vector-acad'
      if (moduleId.includes('@tarikjabiri/dxf')) return 'layout2vector-dxf'
      if (moduleId.includes('@node-projects/layout2vector')) return 'layout2vector'
    },
    format:     'es',
    sourcemap:  is_prod ? null : 'inline',
  },
  plugins,
  watch: {
    allowInputInsideOutputPath: true,
    exclude: ['node_modules/**'],
  }
}
