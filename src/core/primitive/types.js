/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Primitive data contracts shared by scene objects, preprocessing, and
 * simulation engines.
 * @file
 */

/**
 * @typedef {Object} LineSegmentCurveParams
 * @property {Point} start - The start endpoint.
 * @property {Point} end - The end endpoint.
 */

/**
 * @typedef {Object} CircularArcCurveParams
 * @property {Point} start - The start endpoint.
 * @property {Point} end - The end endpoint.
 * @property {number} bulge - The tangent of one quarter of the signed sweep angle from `start` to `end`. A positive sweep is counter-clockwise. A zero bulge degenerates to a line segment; absolute values below, equal to, and above 1 describe minor arcs, semicircles, and major arcs respectively.
 */

/**
 * @typedef {Object} CubicBezierCurveParams
 * @property {Point} start - The start endpoint.
 * @property {Point} control1 - The first control point.
 * @property {Point} control2 - The second control point.
 * @property {Point} end - The end endpoint.
 */

/**
 * @typedef {Object} CircleCurveParams
 * @property {Point} center - The center of the circle.
 * @property {number} radius - The nonzero signed radius. Its absolute value defines the geometry; a positive value gives the circle an outward front normal and a negative value gives it an inward front normal.
 */

/**
 * @typedef {Object} LineSegmentPrimitiveCurve
 * @property {'lineSegment'} kind
 * @property {LineSegmentCurveParams} params
 */

/**
 * @typedef {Object} CircularArcPrimitiveCurve
 * @property {'circularArc'} kind
 * @property {CircularArcCurveParams} params
 */

/**
 * @typedef {Object} CubicBezierPrimitiveCurve
 * @property {'cubicBezier'} kind
 * @property {CubicBezierCurveParams} params
 */

/**
 * A complete oriented circle. The sign of its radius determines whether its
 * front normal points away from or toward its center.
 * @typedef {Object} CirclePrimitiveCurve
 * @property {'circle'} kind
 * @property {CircleCurveParams} params
 */

/**
 * A curve which will be extracted as an individual intersection primitive and
 * inserted into the BVH. Open curves are directed from `start` to `end`; this
 * direction may be significant for surfaces. Curve order and direction are
 * ignored for region boundaries.
 *
 * The engine-independent curve parameters are converted during preprocessing
 * into whatever intersection representation an engine requires.
 *
 * Intersection testing assigns every open curve a native parameter `u` from
 * 0 at `start` to 1 at `end`. A line segment uses its affine parameter, a
 * circular arc uses its center-free rational-quadratic parameter, and a cubic
 * Bezier uses its usual Bezier parameter. A circle has no endpoints or useful
 * native parameter and returns the neutral placeholder `u = 0.5`.
 *
 * Reversing a line segment means swapping `start` and `end`. Reversing a
 * circular arc means swapping its endpoints and negating `bulge`. Reversing a
 * cubic Bezier means swapping its endpoints and also swapping `control1` and
 * `control2`. Reversing a circle means negating its radius.
 * @typedef {LineSegmentPrimitiveCurve|CircularArcPrimitiveCurve|CubicBezierPrimitiveCurve|CirclePrimitiveCurve} PrimitiveCurve
 */

/**
 * Controls whether a surface participates in intersection testing for a ray.
 * When `invert` is false, the surface is intersectable for wavelengths in the
 * inclusive interval `wavelength ± bandwidth`. When `invert` is true, the
 * surface is intersectable for wavelengths outside that interval. If the
 * filter rejects a ray, the surface produces no hit and does not participate
 * in surface merging or ray-depth accounting.
 * @typedef {Object} WavelengthFilter
 * @property {number} wavelength - The center wavelength in nm.
 * @property {number} bandwidth - The half-width of the wavelength interval in nm.
 * @property {boolean} invert - Whether wavelengths outside, rather than inside, the interval are accepted.
 */

/**
 * Defines the optical behavior shared by a set of surface primitives. Type
 * definitions must be treated as immutable. Preprocessing uses object identity
 * as a fast path, then structurally deduplicates equivalent plain-data
 * definitions from separately expanded objects. `name` is diagnostic rather
 * than a registry ID, but it remains part of that structural definition so
 * differently named types are kept distinct. The DAG uses the format
 * implemented by the formula utilities in `src/core/formula`.
 *
 * Before evaluating the DAG, the engine converts the hit into a local
 * orthonormal frame. The adjusted, incident-side normal is mapped to `(0, 1)`,
 * and the local x-axis is obtained by rotating that normal clockwise by 90
 * degrees. The normal is adjusted for the side from which the ray arrived, so
 * the incoming unit direction satisfies `d_0y < 0`; a ray exactly tangent to
 * the surface is not considered a hit. For f32 range analysis, `-d_0y` can
 * therefore use the closed range from the smallest positive f32 through 1.
 *
 * The following formula symbols are reserved inputs:
 *
 * - `d_0x`, `d_0y`: components of the incoming unit direction in the local
 *   surface frame.
 * - `P_0s`, `P_0p`: incoming s- and p-polarized powers.
 * - `lambda`: incoming wavelength in nm.
 * - `x`, `y`: world-space coordinates of the hit.
 * - `u`: the native curve parameter at the hit. It is in `[0, 1]` for line
 *   segments, circular arcs, and cubic Bezier curves. A circle supplies the
 *   neutral placeholder `0.5`; code must use the curve kind, rather than this
 *   placeholder, when deciding whether a hit is at an endpoint.
 * - `sigma`: the geometric side of the hit. It is 1 when the ray approaches
 *   against the oriented curve's front normal and -1 when it approaches from
 *   behind that normal. Its range is the discrete union `{-1, 1}` for a
 *   two-sided primitive and the singleton `{1}` for a one-sided primitive.
 * - `n_0`, `n_1`: effective refractive indices on the incident and opposite
 *   sides of the surface respectively.
 *
 * `u` and `sigma` are derived hit inputs, not instance parameters, and
 * therefore are not entries in `paramNames` or the scene parameter buffer.
 * Detector types use the same reserved hit-input symbols and `sigma`
 * convention, although their outputs describe accumulated detector data
 * rather than outgoing rays.
 *
 * For every one-based output index `j` from 1 through `outRayCount`, the DAG
 * must contain the four labeled outputs `d_jx`, `d_jy`, `P_js`, and `P_jp`.
 * `d_jx` and `d_jy` are the outgoing unit direction in the same local frame;
 * `P_js` and `P_jp` are its s- and p-polarized powers. A slot whose two powers
 * are both zero is ignored. The output count and layout never vary at runtime.
 * Outgoing rays inherit the incoming wavelength and non-optical bookkeeping.
 *
 * Existing angle-based Custom Surface formulas can be translated with
 * `theta_0 = atan2(-d_0x, -d_0y)`, then with
 * `d_jx = -sin(theta_j)` and `d_jy = -cos(theta_j)`. Polarization is evaluated
 * directly through `P_0s` and `P_0p`; there is no polarization-selector input.
 * If the two polarizations leave in different directions, they occupy separate
 * output slots and the unused power component of each slot is zero.
 *
 * WGSL range specialization uses the actual packed f32 parameter values of all
 * primitives sharing this type, rather than a largest declared parameter
 * range. Changing instance parameters requires recompilation only when the
 * range-dependent WGSL safety decisions change; otherwise the engine only
 * updates its parameter buffer.
 *
 * @typedef {Object} SurfaceType
 * @property {string} name - A human-readable diagnostic name, not a registry ID.
 * @property {string[]} paramNames - The formula symbols and keys accepted in a surface primitive's `params` object. Their order defines the packed parameter layout and is therefore significant, particularly for WebGPU buffers. Names must not collide with reserved surface-DAG symbols.
 * @property {Object} dag - The formula DAG containing the required labeled outputs.
 * @property {number} outRayCount - The constant positive number of outgoing-ray slots.
 * @property {boolean} mergesWithGlass - Whether the surface interaction supports coincident glass boundaries.
 */

/**
 * Defines how one invocation emits one ray for a set of source primitives.
 * Like surface types, source type definitions are immutable plain data and are
 * structurally deduplicated during preprocessing, with object identity as a
 * fast path. The DAG uses the format implemented by the formula utilities in
 * `src/core/formula`.
 *
 * The reserved DAG inputs are `i`, the zero-based invocation index, and `N`,
 * the source primitive's total `rayCount`. Both are integer-valued formula
 * scalars and satisfy `0 <= i < N`. An engine only needs to materialize either
 * input when the DAG references it.
 *
 * The DAG must contain the seven labeled outputs `x`, `y`, `d_x`, `d_y`,
 * `P_s`, `P_p`, and `lambda`. `x` and `y` are the emitted ray's world-space
 * starting position; `d_x` and `d_y` are its unit world-space direction;
 * `P_s` and `P_p` are its s- and p-polarized powers; and `lambda` is its
 * wavelength in nm. An invocation whose two powers are both zero is ignored.
 * A source invocation has no incoming ray and emits only one ray, so these
 * output labels do not use ray-index subscripts.
 *
 * Sampling density, brightness limits, color mode, and source-specific
 * rounding are resolved by the scene object when it creates the primitive.
 * They affect `rayCount` and may produce derived entries in `params`, but raw
 * requested or effective ray density is not a reserved DAG input. The source
 * format also has no `gap`, `isNew`, or random-number output.
 *
 * @typedef {Object} SourceType
 * @property {string} name - A human-readable diagnostic name, not a registry ID.
 * @property {string[]} paramNames - The formula symbols and keys accepted in a source primitive's `params` object. Their order defines the packed parameter layout and is therefore significant, particularly for WebGPU buffers. Names must not collide with the reserved inputs `i` and `N`.
 * @property {Object} dag - The formula DAG containing the seven required labeled ray outputs.
 */

/**
 * A ray source. It has no geometry field: its ray distribution is defined
 * entirely by `sourceType` and `params`. A source never contains a
 * {@link PrimitiveCurve} and is not inserted into the BVH. The scene object
 * calculates `rayCount` and any derived sampling parameters each time
 * `getPrimitives()` is called, so changing global sampling settings does not
 * require a separate sizing DAG.
 * @typedef {Object} LightSourcePrimitive
 * @property {'source'} kind
 * @property {SourceType} sourceType - The shared per-invocation ray definition.
 * @property {Object<string, number>} params - Numeric instance and derived sampling parameters matching `sourceType.paramNames`.
 * @property {number} rayCount - The nonnegative integer number of source-formula invocations.
 */

/**
 * An optical surface represented by one oriented curve. For a one-sided
 * surface, an intersection from behind the curve's front normal is ignored
 * completely: it is not a surface hit and does not participate in surface
 * merging or ray-depth accounting. Sidedness is interaction policy rather
 * than curve geometry and is therefore stored at the primitive's top level.
 * @typedef {Object} SurfacePrimitive
 * @property {'surface'} kind
 * @property {PrimitiveCurve} curve - The surface geometry.
 * @property {boolean} twoSided - Whether rays approaching from either side can interact. If false, only rays approaching against the curve's front normal can interact.
 * @property {WavelengthFilter} [filter] - An optional pre-intersection wavelength filter. Omit this property when filtering is disabled.
 * @property {SurfaceType} surfaceType - The shared surface behavior definition.
 * @property {Object<string, number>} params - Numeric instance parameters matching `surfaceType.paramNames`.
 */

/**
 * Defines the relative refractive-index field shared by a set of region
 * primitives. Like surface types, bulk type definitions are immutable plain
 * data and are structurally deduplicated during preprocessing, with object
 * identity as a fast path. The DAG uses the format implemented by the formula
 * utilities in `src/core/formula` and must contain the labeled scalar outputs
 * `n` and `alpha`.
 *
 * The reserved DAG inputs are `x` and `y`, the world-space position at which
 * the field is evaluated, and `lambda`, the ray wavelength in nm. Direction,
 * polarization, and power are not inputs because bulk media are isotropic.
 * Coordinate origins or other instance-specific transformations are expressed
 * through `params`.
 *
 * `alpha` is the local power-absorption coefficient in inverse scene-length
 * units. Propagation through a distance `L` in a locally constant medium
 * multiplies both polarized powers by `exp(-alpha * L)`. Thus zero represents
 * no bulk absorption, positive values absorb light, and negative values
 * represent gain.
 *
 * The formula compiler symbolically derives `n_x` and `n_y`, the partial
 * derivatives of `n` with respect to world-space `x` and `y`. They are part of
 * the compiled evaluator used for GRIN propagation, not independently authored
 * DAG outputs. A wavelength-dependent field with no spatial dependence is
 * still homogeneous and has zero spatial derivatives.
 *
 * @typedef {Object} BulkType
 * @property {string} name - A human-readable diagnostic name, not a registry ID.
 * @property {string[]} paramNames - The formula symbols and keys accepted in a region primitive's `params` object. Their order defines the packed parameter layout and is therefore significant, particularly for WebGPU buffers. Names must not collide with the reserved bulk-DAG symbols.
 * @property {Object} dag - The formula DAG containing the required labeled outputs `n` and `alpha`.
 */

/**
 * A bulk optical region. The curves must collectively form a valid closed
 * boundary. Inside/outside is determined by ray casting, so neither the order
 * nor the direction of the curves has meaning. Each curve belongs only to
 * this region, even when its geometry coincides with another primitive's
 * curve.
 *
 * Region-boundary refraction and reflection are built into the engine rather
 * than represented by a formula-defined surface type. When `partialReflect`
 * is true, a transmissible incident ray produces Fresnel-reflected and
 * transmitted rays. When false, it produces only the transmitted ray. Total
 * internal reflection still produces a reflected ray in either case. More
 * advanced boundary behavior, such as coatings, is represented by overlapping
 * surface primitives instead of additional engine-internal boundary modes.
 *
 * @typedef {Object} RegionPrimitive
 * @property {'region'} kind
 * @property {PrimitiveCurve[]} curves - The region boundary curves.
 * @property {BulkType} bulkType - The shared refractive-index field definition.
 * @property {Object<string, number>} params - Numeric instance parameters matching `bulkType.paramNames`.
 * @property {number} stepSize - The nonnegative interior propagation step size in scene units. Zero denotes a spatially homogeneous region; a positive value enables GRIN propagation.
 * @property {boolean} partialReflect - Whether transmissible boundary interactions generate the Fresnel-reflected ray in addition to the transmitted ray.
 */

/**
 * A mutable holder for the completed result of one logical detector output.
 * Object identity defines the output: detector primitives which reference the
 * same holder accumulate into the same result array, while different holders
 * remain separate even when they belong to the same scene object. This lets a
 * scene object expose several detector outputs without assigning IDs, and lets
 * wrappers such as ModuleObj forward child primitives unchanged.
 *
 * The holder is preprocessing-only metadata and is never sent to a simulation
 * engine or worker. PrimitiveBasedSimulator assigns it a numeric result ID,
 * retains the reverse binding, and updates `values` only after readback from a
 * successfully completed current run. Cancelled, failed, and superseded runs
 * leave it unchanged.
 *
 * @typedef {Object} DetectorResult
 * @property {ArrayLike<number>|null} values - The most recently completed logical result values, or null before a result is available. The simulator may replace this value or update a compatible preallocated typed array.
 */

/**
 * Defines how one detector hit contributes to a logical result array.
 * Detector types use the same immutable, structurally deduplicated plain-data
 * convention as surface types. Their DAG accepts the reserved hit inputs
 * documented by {@link SurfaceType}, including `u` and `sigma`, together with
 * the instance parameters named by `paramNames`.
 *
 * `writeCount` is the fixed positive number of result writes produced by one
 * hit. For every one-based write index `j` from 1 through `writeCount`, the DAG
 * must contain the two labeled scalar outputs `k_j` and `v_j`. The engine
 * accumulates each pair as:
 *
 * ```
 * result[k_j] += v_j
 * ```
 *
 * `k_j` must evaluate to an integer index within the detector primitive's
 * logical `resultSize`. `v_j` is a real-valued contribution. This contract
 * does not prescribe an engine's storage representation or accumulation
 * method; a CPU engine may accumulate floating-point values directly, while
 * another engine may use a different internal representation and convert it
 * during readback.
 *
 * @typedef {Object} DetectorType
 * @property {string} name - A human-readable diagnostic name, not a registry ID.
 * @property {string[]} paramNames - The formula symbols and keys accepted in a detector primitive's `params` object. Their order defines the packed parameter layout and is therefore significant.
 * @property {Object} dag - The formula DAG containing the required `k_j` and `v_j` labeled outputs.
 * @property {number} writeCount - The constant positive number of result writes produced by each hit.
 */

/**
 * A detector represented by one oriented curve. Its type defines how ray
 * incidents are accumulated and exposed as detector results. For a one-sided
 * detector, an intersection from behind the curve's front normal is ignored
 * and produces no detector reading. Detector formulas use the reserved
 * hit-input symbols documented by {@link SurfaceType}, including `u` and
 * `sigma` for
 * distinguishing the two geometric sides; they define detector outputs rather
 * than outgoing-ray slots.
 * @typedef {Object} DetectorPrimitive
 * @property {'detector'} kind
 * @property {PrimitiveCurve} curve - The detector geometry.
 * @property {boolean} twoSided - Whether rays approaching from either side can be detected. If false, only rays approaching against the curve's front normal are detected.
 * @property {DetectorType} detectorType - The shared detector behavior definition.
 * @property {Object<string, number>} params - Numeric instance parameters matching `detectorType.paramNames`.
 * @property {number} resultSize - The positive integer length of the logical result array. Primitives sharing a `result` holder must specify the same size.
 * @property {DetectorResult} result - The result holder. Its object identity associates this primitive with other detector surfaces and with the scene-object state used by `draw()` and result collection.
 */

/**
 * A primitive returned by {@link BaseSceneObj#getPrimitives}.
 * @typedef {LightSourcePrimitive|SurfacePrimitive|RegionPrimitive|DetectorPrimitive} Primitive
 */
