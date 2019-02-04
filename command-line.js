var program = require("commander");
var glob = require("glob");
var path = require("path");
var fs = require("fs");
var amdtoes6 = require("./index");
var mkdirp = require("mkdirp");
const prettier = require("prettier");

program
  .option("-r --root <repoRoot>", "Where to look for the modules")
  .option(
    "-d --dir <dirname>",
    "Use this option to specify a directory to compile."
  )
  .option(
    "-o --out <dirname>",
    "If using the --dir option this specifies the output directory."
  )
  .option(
    "-i --ignore <glob>",
    "If using the --dir options this specifies to exclude eg. libs/**/*",
    function(value, memo) {
      memo.push(value);
      return memo;
    },
    []
  )
  .option(
    "-g --glob [glob]",
    "If using the --dir option, optionally specify the glob pattern to match for input files",
    "**/*.js"
  )
  .option(
    "-b --beautify",
    "Run the output through jsbeautify (mainly useful for fixing indentation)",
    false
  )
  .option("-I --indent [size]", "Sets the indent size for jsbeautify", 4)
  .parse(process.argv);

if (program.dir && !program.out) {
  console.error(
    "If using the --dir option you must also specify the --out option."
  );
  process.exit(1);
}

if (program.dir && program.args.length) {
  console.error(
    "Positional arguments are not allowed if using the --dir option."
  );
  process.exit(1);
}

if (!program.dir && !program.args.length) {
  console.error("No files provided.");
  process.exit(1);
}

var inputFiles = program.args;

if (program.dir) {
  inputFiles = glob.sync(program.glob, {
    cwd: program.dir
  });

  if (program.ignore.length) {
    var ignoreFiles = program.ignore
      .map(function(pattern) {
        return glob.sync(pattern, {
          cwd: program.dir
        });
      })
      .reduce(function(memo, files) {
        return memo.concat(files);
      }, []);

    inputFiles = inputFiles.filter(function(f) {
      return ignoreFiles.indexOf(f) === -1;
    });
  }
}

const tasks = [];

inputFiles.forEach(function(srcFile) {
  var filePath = program.dir ? path.join(program.dir, srcFile) : srcFile;

  var compiled;
  var preprocessedFile = fs
    .readFileSync(filePath, "utf8")
    .toString()
    .replace(/^(import[\s\S]+?;)$/gm, "/*__refactoringImport$1*/")
    .replace(/^define\(['"].*?['"], /gm, "define(");

  try {
    compiled = amdtoes6(preprocessedFile, {
      beautify: program.beautify,
      indent: program.indent
    });
  } catch (e) {
    if (!e.message.includes("'import' and 'export'")) {
      console.error(
        "Unable to compile " + filePath + ".\n  Error:  " + e.message + "\n",
        e
      );
    }
    return;
  }

  tasks.push(
    prettier.resolveConfig(filePath).then(prettierOptions => {
      var finalOutput = compiled
        .replace(/^\/\*__refactoringImport([\s\S]+?)\*\/$/gm, "$1")
        .replace(/^['"]use strict['"];\n/m, "");

      try {
        finalOutput = prettier.format(finalOutput, prettierOptions);
      } catch (e) {
        console.error("Failed to prettify " + filePath);
      }

      if (program.dir) {
        var outdir = path.dirname(path.join(program.out, srcFile));
        mkdirp.sync(outdir);

        fs.writeFileSync(path.join(program.out, srcFile), finalOutput);

        console.log(
          "Successfully compiled",
          filePath,
          "to",
          path.join(program.out, srcFile)
        );

        return {
          moduleEnding: "/" + srcFile.replace(/.[a-z]+$/, "")
        };
      } else {
        console.log(finalOutput);
      }
    })
  );
});

function lookForUsage(moduleEnding, callback) {
  const spawn = require("child_process").spawn;
  const results = [];

  var child = spawn("grep", ["-rH", moduleEnding, program.root]);
  child.stdout.on("data", function(buffer) {
    const [filename, grepResult] = buffer.toString().split(":");
    if (
      !grepResult ||
      (!grepResult.trim().startsWith("import") &&
        !grepResult.trim().startsWith("} from"))
    ) {
      results.push(filename);
    }
  });
  child.stdout.on("end", function() {
    callback(results);
  });
}

Promise.all(tasks).then(successfulTasks => {
  successfulTasks
    .filter(res => Boolean(res))
    .forEach(({ moduleEnding }) => {
      lookForUsage(moduleEnding, results => {
        if (results.length) {
          console.log(`Found AMD usage of ${moduleEnding} in: `);
          console.log(results.join("\n"));
        }
      });
    });
});
