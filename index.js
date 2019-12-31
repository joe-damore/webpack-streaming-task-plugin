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
  for (hours = 0; remaining > HOUR; remaining -= HOUR) { hours ++ }
  for (minutes = 0; remaining > MINUTE; remaining -= MINUTE) { minutes ++ }
  for (seconds = 0; seconds > SECOND; remaining -= SECOND) { seconds ++ }
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
      always = false,
      watchSourceDirectories = false,
    } = this.options;

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
     * Webpack hook that runs when files are emitted.
     *
     * @param {object} compilation - Webpack compilation object.
     * @param {function} callback - Callback upon execution completion.
     */
    compiler.hooks.emit.tapAsync(
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
              return (!compilation.contextDependencies.has(directoryPath))
            })
            // Add directory paths to context dependencies set.
            .forEach((directoryPath) => {
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
            const prevTime = (plugin.prevTimestamps.get(filepath) || plugin.startTime);
            const newTime = (compilation.fileTimestamps.get(filepath) || Infinity);

            return (prevTime < newTime);
          });
        }

        /**
         * Determines whether or not any depended-upon files have changed.
         *
         * @param  {array} dependencyFiles Array of files that are depended on.
         * @param  {array} changedFiles    Array of files that have changed.
         *
         * @return {bool} True if a depended file has changed, false otherwise.
         */
        const dependencyHasChanged = function(dependencyFiles, changedFiles) {
          return changedFiles.some((filepath) => {
            return dependencyFiles.includes(filepath);
          });
        }

        /**
         * Emits a Webpack compilation error.
         *
         * @param  {Object} err - Error object to emit to Webpack.
         */
        const onTaskError = function(err) {
          console.error(`Stopped executing ${colors.yellow(getTaskName())} because an error occurred`);
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

        // Get array of files and directories that this task depends on.
        const dependencyFiles = await getDependencyFiles();
        const dependencyDirs = getDependencyDirectories(dependencyFiles);

        // Add watch files and directories.
        addDependencyFiles(dependencyFiles);
        if (watchSourceDirectories) {
          watchDependencyDirectories(dependencyDirs);
        }

        // Determine which files have changed.
        const changedFiles = getChangedFiles();
        const taskFileHasChanged = dependencyHasChanged(dependencyFiles, changedFiles);

        if (this.prevTimestamps === null || taskFileHasChanged || always) {
          const stream = vfs.src(source);

          // TODO Replace console.log with better output method.
          console.log(`Executing task: ${colors.yellow(getTaskName())}`);
          const taskResult = task(stream)
            .on('error', onTaskError)
            .on('finish', () => {
              taskResult
                .pipe(vfs.dest(destination))
                .on('error', onTaskError)
                .on('finish', onTaskFinish)
            });
        } else {
          callback();
        }

        // Update file timestamp memory.
        this.prevTimestamps = compilation.fileTimestamps;
    });
  }
}

module.exports = WebpackStreamingTaskPlugin;
