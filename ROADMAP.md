# Roadmap

## Make primitive-based engine default (Early 2027)

The original engine (and thus the `checkRayIntersect`, etc, methods in `sceneObj`) will be removed and the primitve based engines (which are currently in beta) will be the only engines.

## `ModuleObj`-based scene objects (Mid 2027)

A module will have more features, such as different parameter types, dependent control points, etc, which are enough to cover all current `sceneObj`'s features. Then all current `sceneObj`s are expected to become module instances, with the only primitive objects being either a primitive optical element or a primitive decorative object (e.g. a line or a text label). Built-in module definition will not be stored in the scene's JSON code.

## Other physics simulations (2028~30)

This project (PhyDemo) is expected to be extended to support other physics simulations, such as 3D ray tracing, wave optics, mechanical simulation, etc, based on the same drag-and-drop scene editing interface, a primitive/module-based scene description, and a sidebar for module editing.