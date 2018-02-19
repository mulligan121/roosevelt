/* eslint-env mocha */

const assert = require('assert')
const fs = require('fs')
const fse = require('fs-extra')
const path = require('path')
const cleanupTestApp = require('../util/cleanupTestApp')
const generateTestApp = require('../util/generateTestApp')
const klawSync = require('klaw-sync')
const fork = require('child_process').fork

describe('JavaScript Section Test', function () {
  const appDir = path.join(__dirname, '../app/jsTest')

  // sample JS source string to test the compiler with
  const test1 = `var a = function() { return 1 + 2}`
  const test2 = `var b = function(multin) { return multin * 4}`
  const test3 = `var c = function(name) {console.log("Hello " + name)}`

  // array of paths to generated static js test files
  let pathsOfStaticJS = [
    path.join(appDir, 'statics', 'js', 'a.js'),
    path.join(appDir, 'statics', 'js', 'b.js'),
    path.join(appDir, 'statics', 'js', 'c.js')
  ]
  // array of paths to generated compiled js test files
  let pathsOfCompiledJS = [
    path.join(appDir, 'statics', '.build', 'js', 'a.js'),
    path.join(appDir, 'statics', '.build', 'js', 'b.js'),
    path.join(appDir, 'statics', '.build', 'js', 'c.js')
  ]
  // array to hold sample JS string data that will be written to a file
  let staticJSFiles = [
    test1,
    test2,
    test3
  ]

  // options to pass into generateTestApp
  let options = {rooseveltPath: '../../../roosevelt', method: 'initServer'}

  beforeEach(function () {
    // start by generating a statics folder in the roosevelt test app directory
    fse.ensureDirSync(path.join(appDir, 'statics', 'js'))
    // generate sample js files in statics by looping through smaple JS source strings
    for (let x = 0; x < pathsOfStaticJS.length; x++) {
      fs.writeFileSync(pathsOfStaticJS[x], staticJSFiles[x])
    }
  })

  afterEach(function (done) {
    // delete the generated test folder once we are done so that we do not have conflicting data
    cleanupTestApp(appDir, (err) => {
      if (err) {
        throw err
      } else {
        done()
      }
    })
  })

  it('should compile all static js files using roosevelt-uglify', function (done) {
    // create the app.js file
    generateTestApp({
      appDir: appDir,
      generateFolderStructure: true,
      js: {
        compiler: {
          nodeModule: 'roosevelt-uglify',
          showWarnings: false,
          params: {}
        }
      }
    }, options)

    // create a fork of the app.js file and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    testApp.on('message', () => {
      // look into the .build folder to see if all the files were compiled and if there is any extras
      const compiledJS = path.join(path.join(appDir, 'statics', '.build', 'js'))
      const compiledJSArray = klawSync(compiledJS)
      compiledJSArray.forEach((file) => {
        let test = pathsOfCompiledJS.includes(file.path)
        assert.equal(test, true)
      })
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      done()
    })
  })

  it('should only compile files that are whitelisted', function (done) {
    //  array that holds the paths for the generated whitelist compiled files
    let pathOfWhiteListedFiles = [
      path.join(appDir, 'statics', '.build', 'js', 'a.js'),
      path.join(appDir, 'statics', '.build', 'js', 'c.js')
    ]
    // create the app.js file
    generateTestApp({
      appDir: appDir,
      generateFolderStructure: true,
      js: {
        compiler: {
          nodeModule: 'roosevelt-uglify',
          showWarnings: false,
          params: {}
        },
        whitelist: ['a.js', 'c.js']
      }
    }, options)
    // create a fork of app.js and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    testApp.on('message', () => {
      // test to see that only the whitelisted file was compiled
      const compiledJS = path.join(path.join(appDir, 'statics', '.build', 'js'))
      const compiledJSArray = klawSync(compiledJS)
      compiledJSArray.forEach((file) => {
        let test = pathOfWhiteListedFiles.includes(file.path)
        assert.equal(test, true)
      })
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      done()
    })
  })

  it('should minify all files except for those that are blacklisted', function (done) {
    // get the buffer(string data) of the static files
    let staticJSFilesA = fs.readFileSync(pathsOfStaticJS[0], 'utf8')
    let staticJSFilesB = fs.readFileSync(pathsOfStaticJS[1], 'utf8')
    let staticJSFilesC = fs.readFileSync(pathsOfStaticJS[2], 'utf8')

    // create the app.js file
    generateTestApp({
      appDir: appDir,
      generateFolderStructure: true,
      js: {
        compiler: {
          nodeModule: 'roosevelt-uglify',
          showWarnings: false,
          params: {}
        },
        blacklist: ['c.js']
      }
    }, options)

    // create a fork of app.js and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    testApp.on('message', () => {
      // get the buffer(string data) of the compiled files
      let compiledJSFilesA = fs.readFileSync(pathsOfCompiledJS[0], 'utf8')
      let compiledJSFilesB = fs.readFileSync(pathsOfCompiledJS[1], 'utf8')
      let compiledJSFilesC = fs.readFileSync(pathsOfCompiledJS[2], 'utf8')
      // test if the buffer from the compiled is the same as their static counterpart
      let test1 = staticJSFilesA === compiledJSFilesA
      let test2 = staticJSFilesB === compiledJSFilesB
      let test3 = staticJSFilesC === compiledJSFilesC
      assert.equal(test1, false)
      assert.equal(test2, false)
      assert.equal(test3, true)
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      done()
    })
  })

  it('should make the output compiled folder with the new name and put all the compiled JS in it', function (done) {
    // array of paths to generated compile js files inside the altered output directory
    let pathsOfAlteredCompiledJS = [
      path.join(appDir, 'statics', '.build', 'jsCompiledTest', 'a.js'),
      path.join(appDir, 'statics', '.build', 'jsCompiledTest', 'b.js'),
      path.join(appDir, 'statics', '.build', 'jsCompiledTest', 'c.js')
    ]

    // create the app.js file
    generateTestApp({
      appDir: appDir,
      generateFolderStructure: true,
      js: {
        compiler: {
          nodeModule: 'roosevelt-uglify',
          showWarnings: false,
          params: {}
        },
        output: '.build/jsCompiledTest'
      }
    }, options)

    // create a fork of app.js and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    testApp.on('message', () => {
      // test to see if the folder exist and if the compiled files are there with no extras
      const compiledJS = path.join(path.join(appDir, 'statics', '.build', 'jsCompiledTest'))
      const compiledJSArray = klawSync(compiledJS)
      compiledJSArray.forEach((file) => {
        let test = pathsOfAlteredCompiledJS.includes(file.path)
        assert.equal(test, true)
      })
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      done()
    })
  })

  it('should make the compiled whitelist file take the name of the delimiter that is passed into it', function (done) {
    // array that holds the path of the delimiter file
    let delimiterOutputArray = [
      path.join(appDir, 'statics', '.build', 'js', 'test', 'something.js')
    ]
    // create the app.js file
    generateTestApp({
      appDir: appDir,
      generateFolderStructure: true,
      js: {
        compiler: {
          nodeModule: 'roosevelt-uglify',
          showWarnings: false,
          params: {}
        },
        whitelist: ['a.js:test/something.js']
      }
    }, options)

    // create a fork of app.js and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    testApp.on('message', () => {
      // grab the folder of where the output should be and check inside it to see if only the whitelist file was compiled and named appropriately
      let pathOfCompiledDLJS = path.join(appDir, 'statics', '.build', 'js', 'test')
      let CompiledDLJSArray = klawSync(pathOfCompiledDLJS)
      CompiledDLJSArray.forEach((file) => {
        let test = delimiterOutputArray.includes(file.path)
        assert.equal(test, true)
      })
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      done()
    })
  })

  it('should copy over the JS files to build without changing them when the noMinify param is true', function (done) {
    // get the buffer (string data) of the static files
    let staticJSFilesA = fs.readFileSync(pathsOfStaticJS[0], 'utf8')
    let staticJSFilesB = fs.readFileSync(pathsOfStaticJS[1], 'utf8')
    let staticJSFilesC = fs.readFileSync(pathsOfStaticJS[2], 'utf8')

    // create the app.js file
    generateTestApp({
      appDir: appDir,
      generateFolderStructure: true,
      noMinify: true,
      js: {
        compiler: {
          nodeModule: 'roosevelt-uglify',
          showWarnings: false,
          params: {}
        }
      }
    }, options)

    // create a fork of app.js and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    testApp.on('message', () => {
      // get the buffer (string data) of the compiled files
      let compiledJSFilesA = fs.readFileSync(pathsOfCompiledJS[0], 'utf8')
      let compiledJSFilesB = fs.readFileSync(pathsOfCompiledJS[1], 'utf8')
      let compiledJSFilesC = fs.readFileSync(pathsOfCompiledJS[2], 'utf8')
      // make tests to compare the buffer in between the static and compiled files
      let test1 = staticJSFilesA === compiledJSFilesA
      let test2 = staticJSFilesB === compiledJSFilesB
      let test3 = staticJSFilesC === compiledJSFilesC
      // test these comparisons
      assert.equal(test1, true)
      assert.equal(test2, true)
      assert.equal(test3, true)
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      done()
    })
  })

  it(`should throw a warning if the app's js compiler nodeModule is undefined`, function (done) {
    // bool var to hold whether or not the specific error message was given
    let failureToIncludeBool = false
    // generate the app.js file
    generateTestApp({
      appDir: appDir,
      generateFolderStructure: true,
      js: {
        compiler: {
          showWarnings: true,
          params: {}
        }
      }
    }, options)

    // fork the app.js file and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    // catch for the specific error of the app failing to include js compiler
    testApp.stderr.on('data', (data) => {
      if (data.includes('failed to include your JS compiler!')) {
        failureToIncludeBool = true
      }
    })

    // exit the app when the app finishes initilization
    testApp.on('message', () => {
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      if (failureToIncludeBool === false) {
        assert.fail('The app did not catch that the error where nodeModule param for the js compiler is undefined')
      }
      done()
    })
  })

  it(`should throw a warning if the app's js compiler nodeModule is set to an incorrect or missing compiler`, function (done) {
    // bool var to hold whether or not the specific error message was given
    let failureToIncludeBool = false
    // generate the app.js file
    generateTestApp({
      appDir: appDir,
      generateFolderStructure: true,
      js: {
        compiler: {
          nodeModule: 'roosevelt-jsCompiler',
          showWarnings: true,
          params: {}
        }
      }
    }, options)

    // fork the app.js file and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    // catch for the specific error of the app failing to include js compiler
    testApp.stderr.on('data', (data) => {
      if (data.includes('failed to include your JS compiler!')) {
        failureToIncludeBool = true
      }
    })

    // exit the app when the app finishes initilization
    testApp.on('message', () => {
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      if (failureToIncludeBool === false) {
        assert.fail('The app did not catch that the error where nodeModule param for the js compiler is undefined')
      }
      done()
    })
  })

  it('should give an error if there is a file named in the whitelist param that does not exists', function (done) {
    // bool var tha that shows whether or not the app had given the warning of a js file not existing
    let jsFileNotExistingBool = false
    // generate the app.js file
    generateTestApp({
      appDir: appDir,
      generateFolderStructure: true,
      js: {
        compiler: {
          nodeModule: 'roosevelt-uglify',
          showWarnings: false,
          params: {}
        },
        whitelist: ['a.js', 'g.js']
      }
    }, options)

    // fork the app.js file and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    // test the error log to see if we get an error that states that the file in the whitelist array does not exist
    testApp.stderr.on('data', (data) => {
      if (data.includes('specified in JS whitelist does not exist')) {
        jsFileNotExistingBool = true
      }
    })

    // when the app is done with its initlization, kill it
    testApp.on('message', () => {
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      if (jsFileNotExistingBool === false) {
        assert.fail('Roosevelt did not catch that a file listed in the whitelist array does not exist.')
      }
      done()
    })
  })

  it('should give an error if if whitelist is not an array/object', function (done) {
    // bool var to hold whether or not the error about how the whitelist was not configured correctly was thrown
    let whitelistConfigureIncorrectlyBool = false
    // create the app.js file
    generateTestApp({
      appDir: appDir,
      generateFolderStructure: true,
      js: {
        compiler: {
          nodeModule: 'roosevelt-uglify',
          showWarnings: false,
          params: {}
        },
        whitelist: true
      }
    }, options)

    // fork the app.js file and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    // test the error log to see if the specific error had been written
    testApp.stderr.on('data', (data) => {
      if (data.includes('JS whitelist not configured correctly')) {
        whitelistConfigureIncorrectlyBool = true
      }
    })

    // exit the app when it finished its initialization
    testApp.on('message', () => {
      testApp.kill('SIGINT')
    })

    // on exit, check if the error was logged
    testApp.on('exit', () => {
      if (whitelistConfigureIncorrectlyBool === false) {
        assert.kill('Roosevelt did not catch that whitelist was assigned a value that is not an object')
      }
      done()
    })
  })

  it('should skip compiling a file if the path is Thumbs.db', function (done) {
    // make a file inside the static js folder that has the name of Thumbs.db
    let fileContent = 'Testing Thumbs.db'
    let filePathName = path.join(appDir, 'statics', 'js', 'Thumbs.db')
    fs.writeFileSync(filePathName, fileContent)
    // generate the app.js file
    generateTestApp({
      appDir: appDir,
      generateFolderStructure: true,
      js: {
        compiler: {
          nodeModule: 'roosevelt-uglify',
          showWarnings: false,
          params: {}
        }
      }
    }, options)

    // fork the app.js file and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    // when server starts, see if a file of Thumbs.db was made on the build
    testApp.on('message', () => {
      let testFilePath = path.join(appDir, 'statics', '.build', 'js', 'Thumbs.db')
      let test = fse.existsSync(testFilePath)
      assert.equal(test, false)
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      done()
    })
  })

  it('should throw an error stating that a file is not coded correctly', function (done) {
    // create a file that has js errors in it
    let fileContent = `console.log('blah'`
    let filePath = path.join(appDir, 'statics', 'js', 'error.js')
    fse.writeFileSync(filePath, fileContent)
    // bool var that holds whether or not Roosevelt will give a warning for a js file not coded correctly
    let fileCodedIncorrectlyBool = false

    // generate the app.js file
    generateTestApp({
      appDir: appDir,
      generateFolderStructure: true,
      js: {
        compiler: {
          nodeModule: 'roosevelt-uglify',
          showWarnings: false,
          params: {}
        }
      }
    }, options)

    // fork the app.js file and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    // check the error logs to see if the specific error has popped up
    testApp.stderr.on('data', (data) => {
      if (data.includes('Please ensure that it is coded correctly')) {
        fileCodedIncorrectlyBool = true
      }
    })

    // when the app starts, kill it
    testApp.on('message', () => {
      testApp.kill('SIGINT')
    })

    // when the app is about to exit, check if the error was logged
    testApp.on('exit', () => {
      if (fileCodedIncorrectlyBool === false) {
        assert.fail('Roosevelt did not catch that a file was coded incorrectly')
      }
      done()
    })
  })
})
