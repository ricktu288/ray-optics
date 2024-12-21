# `test`

This directory contains automatic tests for the project.

- `test/sceneObjs` is the scene object-level tests. It tests the user creation, dragging, and changing properties for each scene object in the source code.
- `test/scenes` is the scene-level tests. Each scene is run with the node module version of the simulator, and compares the output of `CropBox`/`Detector` with the corresponding PNG/CSV files.