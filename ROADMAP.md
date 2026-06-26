# Roadmap

## Primitive-based scene description (in 2 to 6 months)

Instead of each `sceneObj` having its own ray tracing methods such as `checkRayIntersects` and `onRayIncident`, the core of this project will be refactored to use a primitive-based ray tracing system, so that each `sceneObj` will instead have a `getPrimitives` method that returns a list of primitive optical elements based on a list of primitive curves (line segments, arcs, cubic Bezier curves) with attached source types, surface types (e.g. reflective, refractive), and bulk types (e.g. GRIN material), which are defined by parameters and formulas similar to a module. This primitive structure is then sent to a ray tracing engine to perform the ray tracing. This allows for more flexible ray tracing engines (such as the GPU-based one below).

## WebGPU-based ray tracing engine (in 2 to 6 months)

A WebGPU-based ray tracing engine will be implemented based on the above primitive-based scene description. A CPU fallback will be implemented for browsers that do not support WebGPU, but also based on the primitive-based scene description.

## `ModuleObj`-based scene objects (in 1 to 2 years)

A module will have more features, such as different parameter types, dependent control points, etc, which are enough to cover all current `sceneObj`'s features. Then all current `sceneObj`s are expected to become module instances, with the only primitive objects being either a primitive optical element described above, or a primitive decorative object (e.g. a line or a text label). Built-in module definition will not be stored in the scene's JSON code.

## Other physics simulations (in 2 to 5 years)

This project (PhyDemo) is expected to be extended to support other physics simulations, such as 3D ray tracing, wave optics, mechanical simulation, etc, based on the same drag-and-drop scene editing interface, a primitive/module-based scene description, and a sidebar for module editing.