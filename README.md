# Webpack Streaming Task Plugin
Execute tasks during Webpack compilation

[![NPM](https://nodei.co/npm/webpack-streaming-task-plugin.png)](https://nodei.co/npm/webpack-streaming-task-plugin/)

## Overview
This plugin executes streaming tasks during Webpack compilation, and can be
used to easily leverage Gulp plugins while using Webpack.

## Installation
Install the plugin with npm:

`$ npm install webpack-streaming-task-plugin --save-dev`

Or with Yarn:

`$ yarn add webpack-streaming-task-plugin --dev`

## Basic Usage
The example below uses [gulp-cssnano](https://www.npmjs.com/package/gulp-cssnano) and [gulp-rename](https://www.npmjs.com/package/gulp-rename) to minify and
rename a CSS file that is separate from the main Webpack bundle.

```js
const WebpackStreamingTaskPlugin = require('webpack-streaming-task-plugin');

const WebpackConfig = {
  entry: './src/js/index.js',
  output: {
    path: 'dist/js',
    filename: 'index_bundle.js',
  },
  plugins: [
    new WebpackStreamingTaskPlugin({
      name: 'Minify and Rename CSS',
      source: './src/css/stylesheet.css',
      destination: './dist/css',
      task: (task) => {
        return task
          .pipe(cssnano())
          .pipe(rename({
            suffix: 'min',
          }));
      },
    }),
  ]
}
```

## Options
The `options` object can contain the following properties:

- `source`: (String or Array) Glob string or array of glob strings describing task input.
- `destination`: (String) Destination path for task output. (Optional, default `'./'`)
- `task`: (Function) Task function. Includes a `task` parameter with which to pipe output.
- `always`: (Boolean) For watch mode only. When `true`, this task will always be executed when Webpack runs, even if files specified in `source` are unchanged. (Optional, default `false`)
- `watchSourceDirectories`: (Boolean) For watch mode only. When `true`, any changes to any directories containing files specified in `source` trigger a Webpack compilation. This can be useful when creating a new file or directory should trigger a task to execute. (Optional, default `false`)
- `name`: (String) Name of task, used in log output (Optional)
