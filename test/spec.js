var amdToEs6 = require('../index');
var fs = require('fs');

var readFile = function (name) {
    return fs.readFileSync('test/examples/' + name + '.js', 'utf8');
};

var makeTest = function (name) {

    var baseTestName = 'test ' + name.replace(/-/g, ' ');
    var expectedOutputFileName = readFile(name.replace(/-arrow$/, '') + '-expected');

    var makeTestCase = function (inputFilename) {
        return function (test) {
            test.equal(amdToEs6(readFile(inputFilename), {beautify: true}), expectedOutputFileName);
            test.done();
        };        
    };

    exports[baseTestName] = makeTestCase(name);
    exports[baseTestName + ' (using arrow function)'] = makeTestCase(name + '-arrow');

};
makeTest('define-with-deps');
makeTest('define-no-deps');
makeTest('require-with-deps');
makeTest('require-no-deps');
makeTest('inline-sync-requires');
makeTest('preserve-quotes');
makeTest('use-strict');

var makeErrorCaseTest = function (name, message) {

    var makeErrorCaseTest = function(inputFilename) {
        return function (test) {
            test.throws(function () {
                amdToEs6(readFile(inputFilename));
            }, new RegExp(message));
            test.done();
        };
    };

    var baseTestName = 'test ' + name.replace(/-/g, ' ');

    exports[baseTestName + ' throws error'] = makeErrorCaseTest(name);
    exports[baseTestName + ' (using arrow function) throws error'] = makeErrorCaseTest(name + '-arrow');

};
makeErrorCaseTest('multiple-module-definitions', 'Found multiple module definitions in one file.');
makeErrorCaseTest('named-define', 'Found a named define - this is not supported.');
makeErrorCaseTest('umd-module', 'Found a define using a variable as the callback - this is not supported.');
makeErrorCaseTest('nested-module-definitions', 'Found multiple module definitions in one file.');
makeErrorCaseTest('dynamic-module-names', 'Dynamic module names are not supported.');

exports['test no beautify'] = function (test) {
     test.equal(amdToEs6(readFile('no-beautify'), {beautify: false}), readFile('no-beautify-expected'));
     test.done();
};
