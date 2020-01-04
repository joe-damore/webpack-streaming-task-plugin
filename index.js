const bach = require('bach');
const colors = require('ansi-colors');
const globby = require('globby');
const path = require('path');
const vfs = require('vinyl-fs');

const PLUGIN_NAME = 'WebpackStreamingTaskPlugin';
const DEFAULT_TASK_NAME = 'Streaming Task';

/**
 * Emits a Webpack compilation warning for the given compilation object.
 *
 * If no compilation object is available, it falls back to using the
 * console.
 *
 * @param  {object} compilation - Webpack compilation object.
 * @param  {string} message     - Warning message string
 * @param  {object} err         - Warning object, if available.
 */
const emitWarning = function(compilation, message, err = null) {
  const warning = new Error(`${PLUGIN_NAME}: ${message}`);
  if (err) {
    warning.details = err;
  }
  if (compilation) {
    compilation.warnings.push(warning);
    return;
  }
  console.log(`Warning in ${message}`);
  console.log(err);
}

/**
 * Emits a Webpack compilation error for the given compilation object.
 *
 * If no compilation object is available, it falls back to using the
 * console.
 *
 * @param  {object} compilation - Webpack compilation object.
 * @param  {string} message     - Error message string
 * @param  {object} err         - Error object, if available.
 */
const emitError = function(compilation, message, err = null) {
  const error = new Error(`${PLUGIN_NAME}: ${message}`);
  if (err) {
    error.details = err;
  }
  if (compilation) {
    compilation.errors.push(error);
    return;
  }
  console.error(`Warning in ${message}`);
  console.error(err);
}

/**
 * Determines if child is a subdirectory of parent.
 *
 * @param  {string}  child - Path to potential subdirectory.
 * @param  {string}  parent - Path to potential parent directory.
 *
 * @return {Boolean} True if child is a subdirectory of parent, false otherwise.
 */
const isDirectorySubdirectory = function(child, parent) {
  const relative = path.relative(parent, child);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Returns a string describing the given duration in human-readable format.
 *
 * @param  {integer} duration Millisecond duration.
 *
 * @return {string} String describing given duration.
 */
const getDurationString = function(duration) {
  let remaining = duration;

  const MILLISECOND = 1;
  const SECOND = MILLISECOND * 1000;
  const MINUTE = SECOND * 60;
  const HOUR = MINUTE * 60;

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  // Calculate durations.
  for (hours = 0; remaining >= HOUR; remaining -= HOUR) { hours ++ }
  for (minutes = 0; remaining >= MINUTE; remaining -= MINUTE) { minutes ++ }
  for (seconds = 0; remaining >= SECOND; remaining -= SECOND) { seconds ++ }
  let ms = remaining;

  // Generate output string.
  let output = '';
  output = (hours) ? `${hours}h ` : '';
  output += (hours || minutes) ? `${minutes}m ` : '';
  output += (hours || minutes || seconds) ? `${seconds}s` : '';
  output += (!minutes && seconds && ms) ? ' ' : '';
  output += (!minutes && ms) ? `${ms}ms` : '';

  return output;
}

/**
 * Webpack plugin to execute streaming tasks.
 */
class WebpackStreamingTaskPlugin {

  /**
   * Constructor.
   *
   * @param  {object} options - Options object from Webpack.
   */
  constructor(options) {
    this.options = options;

    this.startTime = Date.now();
    this.prevTimestamps = null;

    this.apply = this.apply.bind(this);
  }

  /**
   * Executes plugin.
   *
   * @param  {object} compiler - Webpack compiler object.
   */
  apply(compiler) {
    const {
      source,
      destination = './',
      task,
      name,
      watchSourceDirectories = undefined,
      always = undefined,
    } = this.options;

    const {
      includeSourceDirectories = false,
      skipInitialRun = false,
      changedFilesOnly = false,
      alwaysRun = false,
    } = (this.options.watchMode || {});

    /**
     * Returns the most suitable name for this task.
     *
     * If the 'name' option is defined, it is used. Otherwise, if
     * specified, the task function's name is used. If that is not
     * specified, DEFAULT_TASK_NAME is returned as a last resort.
     *
     * @return {string} Task name.
     */
    const getTaskName = function getTaskName() {
      if (name) {
        return name;
      }
      if (task.name && task.name !== 'task') {
        return task.name;
      }
      return DEFAULT_TASK_NAME;
    }

    /**
     * Webpack hook that runs after files are emitted.
     *
     * @param {object} compilation - Webpack compilation object.
     * @param {function} callback - Callback upon execution completion.
     */
    compiler.hooks.afterEmit.tapAsync(
      PLUGIN_NAME,
      async (compilation, callback) => {

        // Keep track of time it takes for task to execute.
        const taskStartTime = new Date();
        const plugin = this;

        /**
         * Ensures that options object is configured in a valid way.
         *
         * If anything is incorrect, a Webpack warning is emitted.
         *
         * @return {bool} True if everything validates, false otherwise.
         */
        const validateOptions = function validateOptions() {
          if (!source) {
            const message = 'No \'source\' option defined. Skipping plugin execution.';
            emitWarning(compilation, message);
            return false;
          }

          if (!task) {
            const message = 'No \'task\' option defined. Skipping plugin execution.';
            emitWarning(compilation, message);
            return false;
          }

          // Emit a warning if watchSourceDirectories option is used, but don't end execution.
          if (watchSourceDirectories !== undefined) {
            const message = '\'watchSourceDirectories\' option has been deprecated and will be removed in a future release. Use \'watchMode.includeSourceDirectories\' instead.';
            emitWarning(compilation, message);
          }

          /*
           * Emit a warning if watchSourceDirectories option is used, and if it
           * differs from the value provided in watchMode.includeSourceDirectories.
           */
          if (watchSourceDirectories !== undefined && includeSourceDirectories !== watchSourceDirectories) {
            const message = 'Specified \'watchSourceDirectories\' option differs from \'watchMode.includeSourceDirectories\' (which is \'false\' by default). ' +
              'The value given using \'watchSourceDirectories\' will be used instead, but this option is deprecated and will be removed in a future release.';
            emitWarning(compilation, message);
          }

          // Emit a warning if always option is used, but don't cancel execution.
          if (always !== undefined) {
            const message = `'always' option has been deprecated and will be removed in a future release. Use 'watchMode.alwaysRun' instead.`;
            emitWarning(compilation, message);
          }

          /*
           * Emit a warning if always option is used, and if it differs from the
           * value provided in watchMode.alwaysRun.
           */
          if (always !== undefined && alwaysRun !== always) {
            const message = `Specified 'always' option differs from 'watchMode.alwaysRun' (which is 'false' by default). ` +
              `The value given using 'always' will be used instead, but this option is deprecated and will be removed in a future release.`;
              emitWarning(compilation, message);
          }

          // TODO Allow arrays of tasks to be executed in sequence.
          if (typeof task !== 'function') {
            const message = 'Specified \'task\' option should be a function. Skipping plugin execution.';
            emitWarning(compilation, message);
            return false;
          }
          return true;
        }

        /**
         * Gets an array of files that are specified by source option.
         *
         * @return {array} Files specified by source option.
         */
        const getDependencyFiles = async function() {
          return (await globby(source))
            .map((filepath) => {
              // Get resolved absolute paths.
              return path.resolve(filepath);
            });
        }

        /**
         * Adds the given files to the compilation's fileDependencies set.
         *
         * @param {array} dependencyFiles - Array of dependency files to add.
         */
        const addDependencyFiles = function(dependencyFiles) {
          dependencyFiles
            .filter((dependencyFile) => {
              return !(compilation.fileDependencies.has(dependencyFile));
            })
            .forEach((dependencyFile) => {
              compilation.fileDependencies.add(dependencyFile);
            });
        }

        /**
         * Gets an array of directories containing files that are depended upon.
         *
         * @param  {array} dependencyFiles - Files that are depended upon.
         *
         * @return {array} Directories that are depended upon.
         */
        const getDependencyDirectories = function(dependencyFiles) {
          return dependencyFiles
            // Get directory for dependency file.
            .map((filepath) => {
              return path.dirname(filepath);
            });
        }

        /**
         * Adds the given dependency directories to Webpack's watch list.
         *
         * @param {array} dependencyDirs Array of directory paths to watch.
         */
        const watchDependencyDirectories = function(dependencyDirs) {
          dependencyDirs
            // Filter out any directories that are already watched.
            .filter((directoryPath) => {
              // Filter this path if it is already in contextDependencies.
              if (compilation.contextDependencies.has(directoryPath)) {
                return false;
              }

              // Filter this path if a parent directory is already in contextDependencies.
              if(Array.from(compilation.contextDependencies).some((parentPath) => {
                return (isDirectorySubdirectory(directoryPath, parentPath));
              })) {
                return false;
              }

              return true;
            })
            // Add directory paths to context dependencies set.
            .forEach((directoryPath) => {
              // If child paths already exist, they should be removed first.
              Array.from(compilation.contextDependencies)
                .filter((compilationPath) => {
                  if (isDirectorySubdirectory(compilationPath, directoryPath)) {
                    return true;
                  }
                  return false;
                })
                .forEach((compilationPath) => {
                  compilation.contextDependencies.delete(compilationPath);
                })

              // Add the dependency directory.
              compilation.contextDependencies.add(directoryPath);
            });
        }

        /**
         * Gets an array of files that have been changed since the last run.
         *
         * @return {array} Array of files that have been changed.
         */
        const getChangedFiles = function() {
          const timestamps = Array.from(compilation.fileTimestamps.keys());
          return timestamps.filter((filepath) => {
            const prevTime = (() => {
              if (!plugin.prevTimestamps) {
                return plugin.startTime;
              }
              return (plugin.prevTimestamps.get(filepath) || plugin.startTime);
            })();
            const newTime = (compilation.fileTimestamps.get(filepath) || Infinity);

            return (prevTime < newTime);
          });
        }

        /**
         * Returns an array of dependencies which have changed since last run.
         *
         * @param  {array} dependencyFiles Array of files that are depended on.
         * @param  {array} changedFiles    Array of files that have changed.
         *
         * @return {array} Array of dependencies which have changed.
         */
        const getChangedDependencies = function(dependencyFiles, changedFiles) {
          return changedFiles.filter((filepath) => {
            return dependencyFiles.includes(filepath);
          });
        }

        /**
         * Displays a message in the console identifying the task to run.
         */
        const onTaskStart = function() {
          // TODO Replace console.log with better output method.
          console.log(`Executing task: ${colors.yellow(getTaskName())}`);
        }

        /**
         * Emits a Webpack compilation error.
         *
         * Occurs when a task fails to finish because it was interrupted by an
         * error.
         *
         * @param  {Object} err - Error object to emit to Webpack.
         */
        const onTaskExecutionError = function(err) {
          console.error(`Stopped executing ${colors.yellow(getTaskName())} because an error occurred`);
          const message = `${err.message} (During '${getTaskName()}' task)`;
          emitError(compilation, message, err);
          callback();
        }

        /**
         * Emits a Webpack compilation error.
         *
         * Occurs when a task is able to finish, but its output contains at
         * least one error.
         *
         * @param  {Object} err - Error object to emit to Webpack.
         */
        const onTaskResultError = function(err) {
          console.error(`An error occurred while running ${colors.yellow(getTaskName())}`);
          const message = `${err.message} (During '${getTaskName()}' task)`;
          emitError(compilation, message, err);
          callback();
        }

        /**
         * Displays completion message and executes callback.
         */
        const onTaskFinish = function() {
          const taskDuration = (new Date() - taskStartTime);
          console.log(`Finished executing ${colors.yellow(getTaskName())} task in ${colors.whiteBright(getDurationString(taskDuration))}\n`);
          callback();
        }

        // Validate options.
        if (!validateOptions()) {
          // If options fail to validate, cease plugin execution.
          callback();
          return;
        }

        // Determine if any previous timestamps have been saved.
        const noPreviousTimestamps = (
          this.prevTimestamps === null ||
          this.prevTimestamps.length < 1);

        // Check if task should be skipped.
        const shouldSkip = (compiler.watchMode && noPreviousTimestamps && skipInitialRun);

        // Get array of files and directories that this task depends on.
        const dependencyFiles = await getDependencyFiles();
        const dependencyDirs = getDependencyDirectories(dependencyFiles);

        const shouldAlwaysRun = (() => {
          if (always !== undefined) {
            return always;
          }
          return alwaysRun;
        })();

        // Add watch files and directories.
        addDependencyFiles(dependencyFiles);
        const shouldWatchSourceDirectories = (() => {
          if (watchSourceDirectories !== undefined) {
            return watchSourceDirectories;
          }
          return includeSourceDirectories;
        })();
        if (shouldWatchSourceDirectories) {
          watchDependencyDirectories(dependencyDirs);
        }

        // Determine which files have changed.
        const changedFiles = getChangedFiles();
        const changedDependencies = getChangedDependencies(dependencyFiles, changedFiles);
        const taskFileHasChanged = (changedDependencies.length > 0);

        if (shouldSkip) {
          // TODO Replace console.log with better output method.
          console.log(`Skipping task '${colors.yellow(getTaskName())}' during initial run`);
        }
        if ((noPreviousTimestamps || taskFileHasChanged || shouldAlwaysRun) && !shouldSkip) {
          let streamSource = source;

          if (taskFileHasChanged && changedFilesOnly) {
            streamSource = changedDependencies;
          }

          const stream = vfs.src(streamSource);

          const invoke = bach.settleSeries(
            () => {
              return task(stream)
                .pipe(vfs.dest(destination));
            },
            {
              create: function() {
              },
              before: function() {
                onTaskStart();
              },
              after: function() {
                onTaskFinish();
              },
              error: function() {
                onTaskExecutionError();
              },
            });

          invoke((error, results) => {
            if (error) {
              onTaskResultError(error);
            }
            // Update file timestamp memory.
            plugin.prevTimestamps = compilation.fileTimestamps;
          });
        }
        callback();
    });
  }
}

module.exports = WebpackStreamingTaskPlugin;
