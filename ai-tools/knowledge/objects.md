# Scene Objects

This is a list of objects (optical elements, decorations, etc.) that can be used in the scene or modules, and their JSON representation.

Except for the coordinates, all parameters listed below are the default values, and can be omitted if they are not changed.

## Light Source

In each light source below, the `wavelength` property is only effective when `simulateColors` of the scene is set to `true`. To simulate color spectrum, you need to overlap multiple light sources with different wavelengths.

### Single Ray

A light source that emits a single ray of light from point `p1` towards point `p2`.

```json
{
  "type": "SingleRay",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 600, "y": 300 },
  "brightness": 1,
  "wavelength": 540
}
```

### Beam

A beam of light emitted from a line segment defined by two points `p1` and `p2`. The rays are emitted **perpendicular to** the line segment (or with an emission angle of spreading), **not** from `p1` to `p2`. In the following example the rays goes towards the right.

```json
{
  "type": "Beam",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "brightness": 0.5,
  "wavelength": 540,
  "emisAngle": 0,
  "lambert": false
}
```

### 360 Degree Point Source

A point source of light at $(x,y)$.

```json
{
  "type": "PointSource",
  "x": 500,
  "y": 300,
  "brightness": 0.5,
  "wavelength": 540
}
```

### Finite Angle Point Source

A point source of light at `p1` pointing towards `p2` with a finite angle of emission.

```json
{
  "type": "AngleSource",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 600, "y": 300 },
  "brightness": 0.5,
  "wavelength": 540,
  "emisAngle": 30
}
```

## Mirror

In each mirror below, if `filter` is set to `true`, the mirror will only reflect light within `wavelength`-`bandwidth` and `wavelength`+`bandwidth`. If both `filter` and `invert` are set to `true`, the mirror will only reflect light outside that range. The `filter` property is only effective when `simulateColors` of the scene is set to `true`.

### Linear Mirror

A mirror with the shape of a line segment defined by two points `p1` and `p2`.

```json
{
  "type": "Mirror",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "filter": false,
  "invert": false,
  "wavelength": 540,
  "bandwidth": 10
}
```

### Arc Mirror

A mirror with the shape of a circular arc. The arc is defined by two endpoints (`p1` and `p2`) and an additional point on the arc (`p3`) that determines its curvature. In the following example the focal point is at the left of the surface.

```json
{
  "type": "ArcMirror",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "p3": { "x": 510, "y": 350 },
  "filter": false,
  "invert": false,
  "wavelength": 540,
  "bandwidth": 10
}
```

### Parabolic Mirror

A mirror with the shape of a parabola. The parabola is defined by two endpoints (`p1` and `p2`) and the vertex (`p3`). In the following example the focal point is at the left of the surface.

```json
{
  "type": "ParabolicMirror",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "p3": { "x": 510, "y": 350 },
  "filter": false,
  "invert": false,
  "wavelength": 540,
  "bandwidth": 10
}
```

### Parametric Curve Mirror

A mirror with the shape of piecewise defined parametric curve. The `pieces` property is an array of pieces with `eqnX` and `eqnY` equations with a parameter `t` in the range `tMin` to `tMax` with a step size of `tStep` (which determines the sample points on the curve, and can be large if the piece is a line segment). The curve can be either open or closed, and oriented in any direction, but the end of one piece should match the start of the next piece. Here is an example of a closed semicircle:

```json
{
  "type": "ParamMirror",
  "pieces": [
    {
      "eqnX": "``500+50*cos(t)``",
      "eqnY": "``500+50*sin(t)``",
      "tMin": 0,
      "tMax": "`pi`",
      "tStep": 0.01
    },
    {
      "eqnX": "``500+50*t``",
      "eqnY": "``500``",
      "tMin": -1,
      "tMax": 1,
      "tStep": 2
    }
  ]
}
```

In user provided scene created using the visual editor, this object may appear outside a module, and a similar object with `CustomMirror` type may also be used instead whose equation is defined in a relative coordinate system where `p1` and `p2` are $(-1,0)$ and $(1,0)$, respectively. However, when you write JSON code by yourself, please always use the `ParamMirror` type and put it inside a module.

## Blocker

In each blocker below, the if `filter` is set to `true`, the blocker will only block light within `wavelength`-`bandwidth` and `wavelength`+`bandwidth`. If both `filter` and `invert` are set to `true`, the blocker will only block light outside that range. The `filter` property is only effective when `simulateColors` of the scene is set to `true`.

### Linear Blocker

A blocker with the shape of a line segment defined by two points `p1` and `p2`.

```json
{
  "type": "Blocker",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "filter": false,
  "invert": false,
  "wavelength": 540,
  "bandwidth": 10
}
```

In user provided scenes created using the visual editor, they may use the `Aperture` type which is a blocker with a hole in the middle (the hole is defined by `p3` and `p4`). It is not recommended to use this type when writing JSON code directly. Use two `Blocker`s instead.

### Circular Blocker

A blocker with the shape of a circle. The circle is defined by the center (`p1`) and a point on the circle (`p2`).

```json
{
  "type": "CircleBlocker",
  "p1": { "x": 500, "y": 500 },
  "p2": { "x": 600, "y": 500 },
  "filter": false,
  "invert": false,
  "wavelength": 540,
  "bandwidth": 10
}
```

For other shapes, use `CustomArcSurface` or `CustomParamSurface` instead.

## Glass

In each glass below, the `refIndex` property is the index of refraction of the glass. If multiple glasses overlap, the index of refraction in the overlapping region is the product of the indices of refraction of the overlapping glasses. When `simulateColors` of the scene is set to `true`, the `refIndex` is the Cauchy coefficient $A$, and `cauchyB` is the Cauchy coefficient $B$ in micrometer squared in the Cauchy equation $n = A + \frac{B}{\lambda^2}$.

### Half-plane Glass

A glass with the shape of a half-plane defined by two points `p1` and `p2` on its surface. In the example below, the glass extends downward.

```json
{
  "type": "PlaneGlass",
  "p1": { "x": 500, "y": 400 },
  "p2": { "x": 600, "y": 400 },
  "refIndex": 1.5,
  "cauchyB": 0.004
}
```

### Circular Glass

A glass with the shape of a circle. The circle is defined by the center (`p1`) and a point on the circle (`p2`).

```json
{
  "type": "CircleGlass",
  "p1": { "x": 500, "y": 500 },
  "p2": { "x": 600, "y": 500 },
  "refIndex": 1.5,
  "cauchyB": 0.004
}
```

### Polygonal / Circular Arc Glass

A glass with the shape constructed from line segments and circular arcs. The `path` is an array of object with `x` and `y` properties for coordinates, and a boolean `arc`. If `path[i].arc === false`, it means that `path[i-1]`--`path[i]` and `path[i]`--`path[i+1]` are line segments, if `path[i].arc === true`, it means that `path[i-1]`--`path[i]`--`path[i+1]` is a circular arc (where the three points are on the arc).

For example, the following is a rectangle:

```json
{
  "type": "Glass",
  "path": [
    { "x": 500, "y": 500, "arc": false },
    { "x": 600, "y": 500, "arc": false },
    { "x": 600, "y": 600, "arc": false },
    { "x": 500, "y": 600, "arc": false }
  ],
  "refIndex": 1.5,
  "cauchyB": 0.004
}
```

The following is a lens with flat top and bottom edges, and two circular arc surfaces:

```json
{
  "type": "Glass",
  "path": [
    { "x": 700, "y": 240, "arc": false },
    { "x": 740, "y": 240, "arc": false },
    { "x": 760, "y": 320, "arc": true },
    { "x": 740, "y": 400, "arc": false },
    { "x": 700, "y": 400, "arc": false },
    { "x": 680, "y": 320, "arc": true }
  ],
  "refIndex": 1.5,
  "cauchyB": 0.004
}
```

Here, the six points correspond to, respectively:
1. The leftmost point of the top edge
2. The rightmost point of the top edge
3. The intersection of the optical axis and the right surface
4. The rightmost point of the bottom edge
5. The leftmost point of the bottom edge
6. The intersection of the optical axis and the left surface

In user provided scenes created using the visual editor, they may use the `SphericalLens` type which is a wrapper of the above lens shape with UI for editing lens parameters. When writing modules, it is recommended to just use `Glass` and calculate the coordinates in the module directly.

### Parametric Curve Glass

A glass with the shape of piecewise defined parametric curve. The `pieces` property is an array of pieces with `eqnX` and `eqnY` equations with a parameter `t` in the range `tMin` to `tMax` with a step size of `tStep` (which determines the sample points on the curve, and can be large if the piece is a line segment). The curve must be closed (the end of one piece should match the start of the next piece, and the last point of the last piece should match the first point of the first piece) and positively oriented (since the y-axis is pointing downwards, positive corresponds to clockwise on the screen). Here is an example of a closed semicircle:

```json
{
  "type": "ParamGlass",
  "pieces": [
    {
      "eqnX": "``500+50*cos(t)``",
      "eqnY": "``500+50*sin(t)``",
      "tMin": 0,
      "tMax": "`pi`",
      "tStep": 0.01
    },
    {
      "eqnX": "``500+50*t``",
      "eqnY": "``500``",
      "tMin": -1,
      "tMax": 1,
      "tStep": 2
    }
  ],
  "refIndex": 1.5,
  "cauchyB": 0.004
}
```

In user provided scene created using the visual editor, this object may appear outside a module, and a similar object with `CustomGlass` type may also be used instead whose equation is defined in a relative coordinate system where `p1` and `p2` are $(-1,0)$ and $(1,0)$, respectively. However, when you write JSON code by yourself, please always use the `ParamGlass` type and put it inside a module.

### Cubic Bezier Glass

A glass with a shape defined by boundaries composed of cubic Bezier curves. The `points` property is an array of arrays of 2D points with length 3. Point 1 is the first anchor point, points 2 and 3 are the control points, and point 1 of the next curve in the series composing a loop of curves which represents a lens is the second control point of the curve.

## Ideal Objects

### Ideal Lens

A ideal lens defined by a segment (the shape of the infinitely thin lens) from `p1` to `p2` and a focal length (positive for converging, negative for diverging).

```json
{
  "type": "IdealLens",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "focalLength": 100
}
```

### Ideal Curved Mirror

A ideal curved mirror defined by a segment (the nearly flat surface under the paraxial approximation) from `p1` to `p2` and a focal length (positive for converging, negative for diverging).

```json
{
  "type": "IdealCurvedMirror",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "focalLength": 100
}
```

## Diffraction Grating

In each diffraction grating below, the `lineDensity` property is the number of lines per millimeter. To control the intensity, one way is to assume it is an array of microscopic blockers which blocks a ratio of `slitRatio` of the line segment:

Another way is to set `customIntensity` to `true` and set `brightnesses` to an array of numbers between 0 and 1. The numbers in the array correspond to m = 0, 1, -1, 2, -2, …. The number is to be normalized to the brightness of the incident ray.

### Linear Diffraction Grating

A trasmittive (`mirrored == false`) or reflective (`mirrored == true`) linear diffraction grating defined by a segment from `p1` to `p2`.

```json
{
  "type": "DiffractionGrating",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "lineDensity": 100,
  "mirrored": true,
  "slitRatio": 0.5,
  "customIntensity": false,
  "brightnesses": [
    1,
    0.5,
    0.5
  ]
}
```

### Convex Diffraction Grating

A reflective diffraction grating with the shape of a circular arc. The arc is defined by two endpoints (`p1` and `p2`) and an additional point on the arc (`p3`) that determines its curvature. In the following example the focal point is at the left of the surface.

```json
{
  "type": "ConvexDiffractionGrating",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "p3": { "x": 510, "y": 350 },
  "lineDensity": 100,
  "slitRatio": 0.5,
  "customIntensity": false,
  "brightnesses": [
    1,
    0.5,
    0.5
  ]
}
```

For other shapes, use `CustomArcSurface` or `CustomParamSurface` instead.

## Beam Splitter

### Linear Beam Splitter

A linear beam splitter defined by a segment from `p1` to `p2` and a transmission ratio.

```json
{
  "type": "BeamSplitter",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "transRatio": 0.5
}
```

For other shapes, use `CustomArcSurface` or `CustomParamSurface` instead.

## GRIN Glass

In each GRIN glass below, the `refIndexFn` property is the refractive index function $n(x,y,\lambda)$, and the `absorptionFn` property is the absorption function $\alpha(x,y,\lambda)$ (in units of 1/[length]), where $(x,y)$ is the position and `lambda` is the wavelength.

If multiple GRIN glasses overlap (or even a normal glass and a GRIN glass), the index of refraction in the overlapping region is the product of the indices of refraction of the overlapping glasses.

In user provided scene created using the visual editor, such objects may appear outside a module. But when you write JSON code by yourself, please always put GRIN glasses inside a module.

### Circular GRIN Glass

A circular GRIN glass defined by the shape of a circle with center (`p1`) and a point on the circle (`p2`).

```json
{
  "type": "CircleGrinGlass",
  "p1": { "x": 500, "y": 500 },
  "p2": { "x": 500, "y": 600 },
  "refIndexFn": "``1+e^(-((x-500)^2+(y-500)^2)/50^2)``",
  "absorptionFn": "``0``",
  "stepSize": 1
}
```

### Polygonal GRIN Glass

A polygonal GRIN glass defined by the `path` property, which is an array of points.

```json
{
  "type": "GrinGlass",
  "path": [
    { "x": 500, "y": 500 },
    { "x": 600, "y": 500 },
    { "x": 600, "y": 600 },
    { "x": 500, "y": 600 }
  ],
  "refIndexFn": "``1+e^(-((x-500)^2+(y-500)^2)/50^2)``",
  "absorptionFn": "``0``",
  "stepSize": 1
}
```

### Parametric GRIN Glass

A GRIN glass with the shape of piecewise defined parametric curve. The `pieces` property is an array of pieces with `eqnX` and `eqnY` equations with a parameter `t` in the range `tMin` to `tMax` with a step size of `tStep` (which determines the sample points on the curve, and can be large if the piece is a line segment). The curve must be closed (the end of one piece should match the start of the next piece, and the last point of the last piece should match the first point of the first piece) and positively oriented (since the y-axis is pointing downwards, positive corresponds to clockwise on the screen). Here is an example of a closed semicircle:

```json
{
  "type": "ParamGrinGlass",
  "pieces": [
    {
      "eqnX": "``500+50*cos(t)``",
      "eqnY": "``500+50*sin(t)``",
      "tMin": 0,
      "tMax": "`pi`",
      "tStep": 0.01
    },
    {
      "eqnX": "``500+50*t``",
      "eqnY": "``500``",
      "tMin": -1,
      "tMax": 1,
      "tStep": 2
    }
  ],
  "refIndexFn": "``1+e^(-((x-500)^2+(y-500)^2)/50^2)``",
  "absorptionFn": "``0``",
  "stepSize": 1
}
```

## Custom Surface

If all the above objects are not enough for your needs, or if you want to create coating of glass objects, you can define surfaces where the angles and brightnesses of the outgoing rays (when a ray is incident on it) are defined by custom equations. In each of the following shapes, the `outRays` array is an array of objects with properties `eqnTheta` and `eqnP`, which are the equations for the angle (in radians relative to the normal direction) and brightness (in arbitrary units) of the outgoing ray, respectively.

The equations can refer to the followings:
- `theta_0`: The angle of the incident ray in radians relative to the normal direction, in the range $[-pi/2, pi/2]$.
- `P_0`: The brightness of the incident ray.
- `lambda`: The wavelength in nanometers (which remains the same for the outgoing rays).
- `p`: The polarization of the incident ray (0 for s-polarized, 1 for p-polarized, and remains the same for the outgoing rays).
- `t`: The position of the incident point on the surface in the parameter space (see individual shapes below).

In addition, the angles and brightnesses are evaluated in sequence as $\theta_1, P_1, \theta_2, P_2, \ldots$ where the index is 1-based corresponding to the order in the `outRays` array. Each equation can refer to the result of eariler equations. If a formula gives an invalid value, that outgoing ray is ignored and its brightness is treated as 0 in later calculations.

When this surface overlaps with the surface of a glass or GRIN glass object, it acts as a coating of the glass. In this case, the refractive indices of the material attached to the same and opposite sides of the incident ray can be referred to as `n_0` and `n_1`, respectively. If this object is inside a glass object, the values are relative to it.

The surface has a `twoSided` property which is a boolean. If it is `false`, the surface only handles the incident ray on one side (see individual shapes below), and the ray incident from the other side will directly pass through the surface. If it is `true`, the surface handles the incident ray on both sides with the same formulas. To have different formulas for the two sides, you can overlap two single-sided surfaces with opposite orientations.

In user provided scene created using the visual editor, such objects may appear outside a module. But when you write JSON code by yourself, please always put custom surfaces inside a module.

### Custom Line Surface

A custom line surface defined by a segment from `p1` to `p2`. The following is an example of a beam splitter with transmission ratio 0.7 and only handles incident rays from the left side.

```json
{
  "type": "CustomSurface",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "outRays": [
    {
      "eqnTheta": "``theta_0``",
      "eqnP": "``0.7*P_0``"
    },
    {
      "eqnTheta": "``pi-theta_0``",
      "eqnP": "``P_0-P_1``"
    }
  ],
  "twoSided": false
}
```

When $t$ is used in the equations, it interpolates linearly from -1 to 1 from `p1` to `p2`.

### Custom Arc Surface

A custom surface with the shape of a circular arc. The arc is defined by two endpoints (`p1` and `p2`) and an additional point on the arc (`p3`) that determines its curvature. The following is an example of a beam splitter with transmission ratio 0.7 and only handles incident rays from the left side.

```json
{
  "type": "CustomArcSurface",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "p3": { "x": 510, "y": 350 },
  "outRays": [
    {
      "eqnTheta": "``theta_0``",
      "eqnP": "``0.7*P_0``"
    },
    {
      "eqnTheta": "``pi-theta_0``",
      "eqnP": "``P_0-P_1``"
    }
  ],
  "twoSided": false
}
```

When $t$ is used in the equations, it interpolates uniformly (with respect to angle) from -1 to 1 between `p1` and `p2`.

### Custom Parametric Surface

A custom surface with the shape of a parametric curve. The `pieces` property is an array of pieces with `eqnX` and `eqnY` equations with a parameter `t` in the range `tMin` to `tMax` with a step size of `tStep` (which determines the sample points on the curve, and can be large if the piece is a line segment). The curve can be either open or closed (but the end of one piece should match the start of the next piece). When `twoSided` is `false`, a positively oriented curve only handles rays from inside to outside, and vice versa. The following is an example of a closed semicircle beam splitter with transmission ratio 0.7 and only handles incident rays from inside to outside.

```json
{
  "type": "CustomParamSurface",
  "pieces": [
    {
      "eqnX": "``500+50*cos(2*pi*t)``",
      "eqnY": "``500+50*sin(2*pi*t)``",
      "tMin": 0,
      "tMax": "`pi`",
      "tStep": 0.01
    }
  ],
  "outRays": [
    {
      "eqnTheta": "``theta_0``",
      "eqnP": "``0.7*P_0``"
    },
    {
      "eqnTheta": "``pi-theta_0``",
      "eqnP": "``P_0-P_1``"
    }
  ],
  "twoSided": false
}
```

When $t$ is used in the equations, it is the same as the parameter $t$ in the piece where the incident ray is on.

## Decorations

### Text Label

A text label at $(x,y)$.

```json
{
  "type": "TextLabel",
  "x": 500,
  "y": 300,
  "text": "Label",
  "fontSize": 24,
  "aligement": "left"
}
```

### Line / Arrow

A line or arrow from `p1` to `p2`.

```json
{
  "type": "LineArrow",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 600, "y": 300 },
  "arrow": false,
  "backArrow": false
}
```