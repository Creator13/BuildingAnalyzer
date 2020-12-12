# BuildingAnalyzer
Tool to analyze the polygon count of buildings added in the #osmcanada-bathurst project

Currently it's hardcoded to grab the buildings I created since I'm currently the only contributor to the project. The tool can be used to analyze any polygon really, if you swap out the query files.

## Usage

To download fresh data from overpass-api, save this data in a geojson file and save the analysis results in an output csv file:
```shell
node buildings.js -o outputfile.csv -s downloadeddata.geojson
```

To analyze an existing geojson file:
```shell
node buildings.js -f existingdata.geojson
```
