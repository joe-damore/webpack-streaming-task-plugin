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
const cssnano = require('gulp-cssnano');
const rename = require('gulp-rename');

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
            suffix: '.min',
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
- `name`: (String) Name of task, used in log output (Optional)
- `watchMode`: (Object) Configuration object for options related to Webpack's watch mode. (Optional)
- `watchMode.includeSourceDirectories`: (Boolean) Only applies in watch mode. By default, Webpack only watches for changes to the files specified by `source`, but directory-level changes (new files, new child directories, etc.) are ignored. When `includeSourceDirectories` is `true`, changes to any directories that contain files specified in `source` will trigger recompilation. (Optional, default `false`)
- `watchMode.skipInitialRun`: (Boolean) Only applies in watch mode. When `true`, this task is not executed upon Webpack's initial run. Instead, it will only run once changes to its source files are detected. (Optional, default `false`)
- `watchMode.alwaysRun`: (Boolean) Only applies in watch mode. When `true`, this task is always executed when Webpack runs, even if files specified in `source` are unchanged. If `watchMode.skipInitialRun` is also `true`, `skipInitialRun` takes priority and the first run will be skipped despite `alwaysRun` being `true`. (Optional, default `false`)
- `watchMode.changedFilesOnly`: (Boolean) Only applies in watch mode. When `true`, only files which have changed since last run will be included in the stream passed to this task. (Optional, default `false`)

### Deprecated Options
The following options should no longer be used and will be removed in future releases. They only exist for legacy compatibility.

- `always`: (Boolean) Deprecated. For watch mode only. Serves the same purpose as `watchMode.alwaysRun`. **This option is deprecated. Use `watchMode.alwaysRun` instead.**
- `watchSourceDirectories`: (Boolean) Deprecated. For watch mode only. Serves the same purpose as `watchMode.includeSourceDirectories`. **This option is deprecated. Use `watchMode.includeSourceDirectories` instead.**
