# Ray Optics Simulation - Integration Tools

Version: 5.1+20250420.a62518c

This package contains tools for integrating the Ray Optics Simulation engine with other programming languages.

## Contents

- `rayOptics.js` - The core simulation engine
- `runner.js` - Command-line interface for the simulation engine
- `example_python.py` - Python example
- `example_julia.jl` - Julia example

## Usage

You need to have Node.js installed to use this package. You can download it from [nodejs.org](https://nodejs.org/).
You don't need to download the web app to use this package.

The `runner.js` script takes a JSON scene description via stdin and outputs simulation results to stdout. See the example files for how to call the script from some languages.
The JSON format is the same as the scene file saved by the web app (one can also directly view and edit the JSON in the web app by enabling Settings -> Show JSON editor).

### Getting Detector Reading

For every detector object in the scene (which in the web app can be created by Tools -> Other -> Detector), the script will return a detector reading object in the result. The detector reading object has the following properties:

- `name`: The name of the detector
- `power`: The rate of energy flow (P in the web app)
- `normal`: The rate of perpendicular momentum flow (F⊥ in the web app)
- `shear`: The rate of longitudinal momentum flow (F∥ in the web app)

If the detector has `irradMap` set to true, the following additional properties will be included:

- `irradianceMap`: An array of intensity values of each bin
- `binPositions`: An array of position values of each bin

See the example files for how to read these properties in your code.
For the units, see the info box of the detector object in the web app.

### Getting Image

To generate an image, you need to have `node-canvas` installed. On most platforms, you can install it using npm by running the following in the current directory:
```bash
npm install canvas
```

On some platforms, you may need to install additional dependencies. See [node-canvas](https://github.com/Automattic/node-canvas) for more information.

For every crop box object in the scene (which in the web app can be created by File -> Export as PNG/SVG but without clicking "Save"), the script will return an image object in the result. The image object has the following properties:

- `name`: The name of the crop box
- `dataUrl`: The base64 encoded data URL of the image

See the example files for how to read and save the image in your code.

The image generation feature currently only supports PNG, and does not work with "Correct Brightness" and glasses with (relative) refractive index below 1.

### Simulator Statistics

The JSON data returned by the script will also include some statistics about the simulation:

- `totalTruncation`: The total truncated brightness of rays in the infinite series of internal reflection during the simulation
- `processedRayCount`: The total number of processed ray segments in the simulation
- `brightnessScale`: The brightness scale of the simulation (see the info box of a detector object in the web app for more information)
- `error`: Any errors that occurred during the simulation
- `warning`: Any warnings that occurred during the simulation

## Citing

If you use this project in your research, please cite it according to the metadata:
```bibtex
@misc{RayOptics,
  author = {Tu, Yi-Ting and others},
  title = {{Ray Optics Simulation}},
  year = {2016},
  doi = {10.5281/zenodo.6386611}
}
```

See https://github.com/ricktu288/ray-optics#cite-this-project for more information.

## License

This software is licensed under the Apache License, Version 2.0. See the LICENSE file for details.
