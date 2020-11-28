const fs = require('fs');
const overpass = require('query-overpass');
// const yargs = require('yargs');
const yesno = require('yesno');
const { exit } = require('process');

let argv = require('yargs/yargs')(process.argv.slice(2))
    .option('save-query-result', {
        alias: 'r',
        type: 'string'
    })
    .option('out', {
        alias: 'o',
        type: 'string',
        default: "out.csv"
    })
    .option('file', {
        alias: 'f',
        type: 'string'
    })
    .option('compare', {
        alias: 'c',
        type: 'boolean'
    })
    .argv;

// Dirty fix to only use the 'out' option (or its default) if the option is present at all.
// Needs to support all of its aliases too...
const toFile = process.argv.indexOf('-o') > -1 || process.argv.indexOf('--out') > -1;

//-----------------------------------------//
function parseJsonFromFile(fileName) {
    let raw = fs.readFileSync(fileName);
    return data = JSON.parse(raw);
}

function countPolygonFrequency(dataset) {
    let frequency = {};
    let total = 0;

    // Calculate and store the sizes of all polygons
    dataset.features.forEach(feature => {
        let polySize = countNodes(feature.geometry.coordinates)

        // If a polygon size does not exist in the dict the value will be NaN, so use this to make it a number
        if (isNaN(frequency[polySize])) {
            frequency[polySize] = 0;
        }

        frequency[polySize]++;
        total++;
    });

    return { userTotal: total, frequency: frequency };
}

// Count the nodes of one feature
function countNodes(coordinates) {
    let nodes = 0;
    // A coordinate block contains ways as arrays. 
    // In simple ways, it will only contain the one way the feature is composed of, in relations it will contain all the ways in the relation.
    coordinates.forEach(way => {
        // All ways include the 'starting' node twice, so subtract one node to correct this.
        nodes += way.length - 1;
    });
    return nodes;
}

function saveGeojson(fileName, data) {
    if (fileName === '') {
        console.error('\x1b[31m%s\x1b[0m', "Could not save to geojson: no filename specified.");
        return;
    }

    let json = JSON.stringify(data)

    fs.writeFile(`${argv["save-query-result"]}`, json, 'utf8', (err) => {
        if (err) {
            console.error('\x1b[31m%s\x1b[0m', "An error occured while writing query result to file.");
            return console.log(err);
        }

        console.log(`Overpass query result has been saved to ${argv["save-query-result"]}`);
    });
}

async function downloadOverpassData(query) {
    return new Promise(function (resolve, reject) {
        console.log("Downloading data from Overpass API...");

        overpass(query, (error, result) => {
            if (error) {
                console.error(error);
                reject(error);
            }

            resolve(result);
        });
    });
}
//-----------------------------------------//

function showData(result) {
    for (let key in result.frequency) {
        console.log(`${key}: ${result.frequency[key]}`);
    }

    console.log(`User total: ${result.userTotal} (${(result.userTotal / result.total * 100).toFixed(2)}%)`);
}

async function areYouSureYouWantToContinue(fileName) {
    const ok = await yesno({
        question: `File ${fileName} already exists. Are you sure you want to continue? (y/n)`
    });

    if (!ok) {
        console.log("Exiting...");
        exit();
    }
}

async function checkFileOverwrite() {
    if (toFile) {
        if (fs.existsSync(argv.out)) {
            await areYouSureYouWantToContinue(argv.out);
        }
    }

    if (argv["save-query-result"] !== undefined) {
        if (fs.existsSync(`${argv["save-query-result"]}`)) {
            await areYouSureYouWantToContinue(argv["save-query-result"]);
        }
    }
}

async function main() {
    await checkFileOverwrite();

    if (argv.file !== undefined) {
        if (argv.file === '') {
            console.error('\x1b[31m%s\x1b[0m', "Could not read input file: no filename specified.");
            process.exit(9);
        }

        if (!fs.existsSync(argv.file)) {
            console.log('\x1b[31m%s\x1b[0m', "Could not read input file: file does not exist.");
            process.exit(9);
        }

        var data = parseJsonFromFile(argv.file);
    }
    else {
        let queryPersonal = fs.readFileSync('query-personal.txt', 'utf-8');

        var data = await downloadOverpassData(queryPersonal);

        if (argv["save-query-result"] !== undefined) {
            saveGeojson(argv.save, data);
        }

        let queryTotal = fs.readFileSync('query-total.txt', 'utf-8');
        var allBuildings = await downloadOverpassData(queryTotal);
    }

    // Count polygons - This is where the magic happens
    let result = countPolygonFrequency(data);

    if (toFile) {
        let csvString = "count,frequency\n";
        for (let key in result.frequency) {
            csvString += `${key},${result.frequency[key]}\n`;
        }

        fs.writeFile(argv.out, csvString, 'utf-8', (err) => {
            if (err) {
                console.error('\x1b[31m%s\x1b[0m', "An error occured while writing results to file.")
                return console.error(err);
            }

            console.log(`Results written to ${argv.out}`);
        });
    }

    // Append total buildings (non-user inclusive) to result
    result.total = allBuildings.features.length;

    showData(result);
}

main();