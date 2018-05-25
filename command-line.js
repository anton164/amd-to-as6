var program = require('commander');
var glob = require('glob');
var path = require('path');
var fs = require('fs');
var amdtoes6 = require('./index');
var mkdirp = require('mkdirp');

program
    .option('-d --dir <dirname>',
            'Use this option to specify a directory to compile.')
    .option('-o --out <dirname>',
            'If using the --dir option this specifies the output directory.')
    .option('-i --ignore <glob>',
            'If using the --dir options this specifies to exclude eg. libs/**/*',
            function (value, memo) {
                memo.push(value);
                return memo;
            }, [])
    .option('-g --glob [glob]',
            'If using the --dir option, optionally specify the glob pattern to match for input files',
            '**/*.js')
    .option('-b --beautify',
            'Run the output through jsbeautify (mainly useful for fixing indentation)',
            false)
    .option('-I --indent [size]',
            'Sets the indent size for jsbeautify',
            4)
    .option('-r --replace', 'Replaces existing file')
    .parse(process.argv);

if (program.dir && !program.out) {
    console.error('If using the --dir option you must also specify the --out option.');
    process.exit(1);
}

if (program.dir && program.args.length) {
    console.error('Positional arguments are not allowed if using the --dir option.');
    process.exit(1);
}

if (!program.dir && !program.args.length) {
    console.error('No files provided.');
    process.exit(1);
}

var inputFiles = program.args;
var htmlFiles = [];

if (program.dir) {

    inputFiles = glob.sync(program.glob, {
        cwd: program.dir,
        ignore: program.ignore.length ? program.ignore : "node_modules/**/*"
    });

    htmlFiles = glob.sync("**/*.html", {
        cwd: program.dir,
        ignore: program.ignore.length ? program.ignore : "node_modules/**/*"
    });
}

var filePathes = [...inputFiles, ...htmlFiles.map((f) => f.replace('.html', '.js'))];

inputFiles.forEach(function (srcFile) {

    var filePath = program.dir ? path.join(program.dir, srcFile) : srcFile;

    var context = fs.readFileSync(filePath, 'utf8');
    var compiled;

    try {
        compiled = amdtoes6(context, {
            beautify: program.beautify,
            indent: program.indent,
            filePathes,
            filePath
        });
    }
    catch (e) {
        console.error('Unable to compile ' + filePath + '.\n  Error:  ' + e.message + '\n');
        return;
    }

    if (program.dir) {
        var p = path.join(program.out, srcFile);

        if (fs.existsSync(p) && !program.replace) {
            console.log(`${filePath} already exists`);
        } else {
            var outdir = path.dirname(p);
            mkdirp.sync(outdir);
    
            fs.writeFileSync(path.join(program.out, srcFile), compiled);
            console.log('Successfully compiled', filePath, 'to', path.join(program.out, srcFile));
        }
    }
    else {
        console.log(compiled);
    }

});
