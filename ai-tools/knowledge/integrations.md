# Integrations

After the user downloaded the integration tools, they can use the `runner.js` script to call the simulator from their code.

The `runner.js` script takes a JSON scene description via stdin and outputs simulation results to stdout. See the example files for how to call the script from some languages.

## Getting Detector Reading

A detector object has the following format:
```json
{
  "type": "Detector",
  "p1": { "x": 100, "y": -50 },
  "p2": { "x": 100, "y": 50 },
  "irradMap": true,
  "binSize": 20
}
```
For every detector object in the scene, the script will return a detector reading object in the result. The detector reading object has the following properties:

- `power`: The rate of energy flow
- `normal`: The rate of perpendicular momentum flow
- `shear`: The rate of longitudinal momentum flow

If the detector has `irradMap` set to true, the following additional properties will be included:

- `irradianceMap`: An array of intensity values of each bin
- `binPositions`: An array of position values of each bin

## Getting Image

Before using image generation, the user needs to have the `node-canvas` package installed by running `npm install node-canvas`.

To generate an image, you need to add a crop box object to the scene with the following format:
```json
{
  "type": "CropBox",
  "p1": { "x": -100, "y": -100 },
  "p4": { "x": 100, "y": 100 },
  "width": 500
}
```
where `p1` and `p4` define the upper left and lower right corners of the crop box, and `width` is the width of the image. For every crop box object in the scene, the script will return an image object in the result. The image object has the following properties:

- `dataUrl`: The base64 encoded data URL of the image

## Simulator Statistics

The JSON data returned by the script will also include some statistics about the simulation:

- `totalTruncation`: The total truncated brightness of rays in the infinite series of internal reflection during the simulation
- `processedRayCount`: The total number of processed ray segments in the simulation
- `brightnessScale`: The brightness scale of the simulation (see the info box of a detector object in the web app for more information)
- `error`: Any errors that occurred during the simulation
- `warning`: Any warnings that occurred during the simulation


