# `test`

This directory contains automatic tests for the project.

- `test/formula` tests the formula parser, DAG transformations, CPU evaluators, and WGSL source generation. These tests do not execute WebGPU.
- `test/propertyUtils` is unit tests for `src/core/propertyUtils` (formula parsing, key paths, equation conversion, and parametrization). These run first in `npm run test`.
- `test/sceneObjs` is the scene object-level tests. It tests the user creation, dragging, and changing properties for each scene object in the source code.
- `test/scenes` is the scene-level tests. Each scene is run with the node module version of the simulator, and compares the output of `CropBox`/`Detector` with the corresponding PNG/CSV files.

By default, `npm run test:scenes` uses the legacy simulation engine. To select
the primitive CPU engine and optionally override its settings, run:

```bash
npm run test:scenes -- --engine=primitiveCpu
npm run test:scenes -- --engine=primitiveCpu --engine-settings='{"numericEpsilon":2.220446049250313e-16}'
npm run test:scenes -- --engine=primitiveCpu --engine-settings='{"rayCountLimit":1000000}'
```

Additional arguments are forwarded to Jest.
